"""
Google OAuth 2.0 Authentication Service
Handles Google OAuth flow and token management
"""

from typing import Optional, Dict, Any
import json
import logging
from datetime import datetime, timedelta
import httpx
import base64
import urllib.parse
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import jwt

logger = logging.getLogger(__name__)


class GoogleOAuthService:
    """
    Service for handling Google OAuth 2.0 authentication
    """

    def __init__(self, config: Dict[str, Any]):
        self.client_id = config.get("google_client_id")
        self.client_secret = config.get("google_client_secret")
        self.redirect_uri = config.get("google_redirect_uri")
        self.scopes = [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ]
        self.private_key = self._generate_private_key()

    def _generate_private_key(self) -> bytes:
        """Generate RSA private key for JWT signing"""
        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def generate_auth_url(self, state: str, access_type: str = "offline") -> str:
        """
        Generate Google OAuth authorization URL

        Args:
            state: Random state parameter for CSRF protection
            access_type: 'offline' for refresh tokens, 'online' for limited access

        Returns:
            Authorization URL for redirect
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "access_type": access_type,
            "state": state,
            "prompt": "consent" if access_type == "offline" else "",
        }

        query_string = urllib.parse.urlencode(params)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens

        Args:
            code: Authorization code from callback

        Returns:
            Dictionary containing tokens and user info
        """
        try:
            token_data = {
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                if response.status_code != 200:
                    logger.error(f"Token exchange failed: {response.text}")
                    raise Exception("Failed to exchange code for tokens")

                tokens = response.json()
                tokens["obtained_at"] = datetime.now().isoformat()

                # Get user info
                user_info = await self.get_user_info(tokens["access_token"])
                tokens["user_info"] = user_info

                return tokens

        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {str(e)}")
            raise

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token

        Args:
            refresh_token: Valid refresh token

        Returns:
            Dictionary containing new access token
        """
        try:
            token_data = {
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                if response.status_code != 200:
                    logger.error(f"Token refresh failed: {response.text}")
                    raise Exception("Failed to refresh token")

                tokens = response.json()
                tokens["obtained_at"] = datetime.now().isoformat()

                return tokens

        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            raise

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get user information from Google

        Args:
            access_token: Valid access token

        Returns:
            User information dictionary
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                )

                if response.status_code != 200:
                    logger.error(f"Failed to get user info: {response.text}")
                    raise Exception("Failed to get user info")

                return response.json()

        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            raise

    def create_id_token(self, user_info: Dict[str, Any]) -> str:
        """
        Create custom ID token for application use

        Args:
            user_info: User information dictionary

        Returns:
            JWT token string
        """
        payload = {
            "sub": user_info.get("id"),
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
            "iss": "aio-creative-hub",
            "aud": self.client_id,
            "iat": datetime.now().timestamp(),
            "exp": (datetime.now() + timedelta(days=7)).timestamp(),
        }

        token = jwt.encode(payload, self.private_key, algorithm="RS256")

        return token

    def verify_id_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify and decode custom ID token

        Args:
            token: JWT token to verify

        Returns:
            Decoded payload or None if invalid
        """
        try:
            public_key = serialization.load_pem_private_key(
                self.private_key, password=None, backend=default_backend()
            ).public_key()

            decoded = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer="aio-creative-hub",
            )

            return decoded

        except Exception as e:
            logger.error(f"Error verifying token: {str(e)}")
            return None

    async def revoke_token(self, token: str) -> bool:
        """
        Revoke access token

        Args:
            token: Token to revoke

        Returns:
            True if successful
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/revoke", data={"token": token}
                )

                return response.status_code == 200

        except Exception as e:
            logger.error(f"Error revoking token: {str(e)}")
            return False

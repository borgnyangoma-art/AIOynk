#!/bin/bash

# SSL Certificate Generation Script
# Usage: ./generate-cert.sh [domain]

set -e

DOMAIN=${1:-aio-creative-hub.com}
DAYS=365
COUNTRY="US"
STATE="CA"
CITY="San Francisco"
ORG="AIO Creative Hub"
OU="IT Department"
EMAIL="admin@aio-creative-hub.com"

CERT_DIR="./ssl"
mkdir -p $CERT_DIR

echo "Generating SSL certificate for $DOMAIN..."

# Generate private key
openssl genrsa -out $CERT_DIR/$DOMAIN.key 2048

# Generate certificate signing request
openssl req -new -key $CERT_DIR/$DOMAIN.key -out $CERT_DIR/$DOMAIN.csr -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$OU/CN=$DOMAIN/emailAddress=$EMAIL"

# Generate self-signed certificate (for development/testing)
openssl x509 -req -in $CERT_DIR/$DOMAIN.csr -signkey $CERT_DIR/$DOMAIN.key -out $CERT_DIR/$DOMAIN.crt -days $DAYS

# Generate combined cert file (cert + chain)
cat $CERT_DIR/$DOMAIN.crt $CERT_DIR/$DOMAIN.key > $CERT_DIR/$DOMAIN.pem

# Set proper permissions
chmod 600 $CERT_DIR/$DOMAIN.key
chmod 644 $CERT_DIR/$DOMAIN.crt
chmod 644 $CERT_DIR/$DOMAIN.csr

echo "SSL certificates generated successfully!"
echo "Certificate: $CERT_DIR/$DOMAIN.crt"
echo "Private Key: $CERT_DIR/$DOMAIN.key"
echo "Combined: $CERT_DIR/$DOMAIN.pem"
echo ""
echo "⚠️  This is a self-signed certificate suitable for development only!"
echo "For production, use certificates from a trusted CA (Let's Encrypt, etc.)"

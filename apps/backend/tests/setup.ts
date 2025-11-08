import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0gN2L3Y0w0E2VqL1c9
tPJ1pUgx8Q2OwG9d8G5J+B8w4f0lZL9j/nXC6wR4r7P8K8qG6M4K0oN6U5WzN0t4
O2Z3A0t3B1S2F1S1J7E0c5r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5
X6Y7Z0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d
0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2
k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4Q
IDAQABAoIBAGrqcUqj8xG2N7S8j8Q8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
ECgYEA7F8V2Y8K0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c
3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5
j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p
8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q7K0oN6U5WzN
0t4O2Z3A0t3B1S2F1S1J7E0c5r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4
W5X6Y7Z0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c
ECgYEA1G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c3d4e5f6g7h8i9j0
k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q
3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5
x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q7K0oN6U5WzN0t4O2Z3A0t3B1S2
F1S1J7E0c5r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c3
d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j
6k7l8m9n0o1p2q3r4s5t6ECgYEAz8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8
ECgYBZ5g5h6i7j8k9l0m1n2o3p4q7K0oN6U5WzN0t4O2Z3A0t3B1S2F1S1J7E0c5
r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c3d4e5f6g7h8
i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0
o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u
3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q7K0oN6U5WzN0t4O2Z3A0
t3B1S2F1S1J7E0c5r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4
m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q
-----END RSA PRIVATE KEY-----`;
process.env.JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0gN2L3Y0w0E2VqL1c9tPJ1pUgx8Q2OwG9d8G5J+B8w4f0lZL9j/nXC
6wR4r7P8K8qG6M4K0oN6U5WzN0t4O2Z3A0t3B1S2F1S1J7E0c5r5U0q4B0L2G1K6
G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7
v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9
b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q7K0oN6U5WzN0t4O2Z3A0t3B1S2F1S1J7
E0c5r5U0q4B0L2G1K6G0F4E0t6F5O7I8Q9R0S1T2U3V4W5X6Y7Z0a1b2c3d4e5f6
g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8
m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0
s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4qIDAQAB
-----END PUBLIC KEY-----`;
process.env.JWT_EXPIRATION = '1h';
process.env.REFRESH_TOKEN_EXPIRATION = '7d';
process.env.JWT_ISSUER = 'aio-creative-hub';
process.env.JWT_AUDIENCE = 'aio-users';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aio_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  })),
}));

// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
          },
        }),
      })),
    },
    drive: {
      v3: {
        files: {
          list: jest.fn().mockResolvedValue({ data: { files: [] } }),
          get: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    },
  },
}));

beforeAll(async () => {
  // Setup test environment
});

afterAll(async () => {
  // Cleanup test environment
});

# Testing Guide - AIO Creative Hub

## Overview

This document describes the comprehensive testing strategy for the AIO Creative Hub project, covering unit tests, integration tests, end-to-end tests, performance tests, and security tests.

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Running Tests](#running-tests)
3. [Test Coverage](#test-coverage)
4. [Unit Tests](#unit-tests)
5. [Integration Tests](#integration-tests)
6. [End-to-End Tests](#end-to-end-tests)
7. [Performance Tests](#performance-tests)
8. [Security Tests](#security-tests)
9. [Continuous Integration](#continuous-integration)
10. [Best Practices](#best-practices)

## Test Architecture

```
AIO Creative Hub Testing Suite
├── Unit Tests (Jest + Vitest)
│   ├── Backend Services
│   ├── Frontend Components
│   ├── Utilities & Helpers
│   └── State Management
├── Integration Tests
│   ├── API Endpoints
│   ├── WebSocket Communication
│   ├── Database Operations
│   └── Service-to-Service
├── End-to-End Tests (Playwright)
│   ├── User Authentication
│   ├── Chat Interface
│   ├── Creative Tools
│   └── Cross-browser Testing
├── Performance Tests (K6)
│   ├── Load Testing
│   ├── Stress Testing
│   ├── WebSocket Testing
│   └── Rate Limiting
└── Security Tests
    ├── SQL Injection
    ├── XSS Prevention
    ├── OWASP Top 10
    └── Rate Limiting
```

## Running Tests

### All Tests
```bash
# Run all tests
npm run test:all

# Run tests in watch mode
npm run test:watch
```

### Backend Tests
```bash
# All backend tests
npm run test:backend

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Security tests only
npm run test:security

# With coverage
npm run test:backend -- --coverage
```

### Frontend Tests
```bash
# Frontend tests
npm run test:frontend

# With coverage
npm run test:frontend -- --coverage

# UI mode
npm run test:frontend -- --ui
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e

# UI mode
npm run test:e2e:ui

# Specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Performance Tests
```bash
# Load test
npm run test:performance

# Stress test
npm run test:stress

# WebSocket test
npm run test:websocket

# Rate limit test
npm run test:rate-limit
```

## Test Coverage

### Coverage Targets

| Component | Coverage Target |
|-----------|----------------|
| Backend Services | 80% |
| Frontend Components | 80% |
| Utilities | 90% |
| Overall Project | 80% |

### Generating Coverage Reports

```bash
# Backend coverage
npm run test:backend -- --coverage --coverageReporters=html

# Frontend coverage
npm run test:frontend -- --coverage

# View coverage (open in browser)
open coverage/index.html
```

## Unit Tests

### Backend Unit Tests (Jest)

Located in: `apps/backend/tests/unit/`

#### Authentication Services
- **JWT Service** (`jwt.service.test.ts`)
  - Token generation (access & refresh)
  - Token verification
  - Token expiration handling
  - Algorithm validation (RS256)

- **Google Auth Service** (`google-auth.service.test.ts`)
  - OAuth URL generation
  - Token exchange
  - User info retrieval
  - Token refresh

- **Session Service** (`session.service.test.ts`)
  - Session creation
  - Session retrieval
  - Session updates
  - Session cleanup

- **Auth Middleware** (`auth.middleware.test.ts`)
  - Token validation
  - Unauthorized access prevention
  - User extraction

#### Core Services
- **NLP Service** (`nlp.service.test.ts`)
  - Intent classification
  - Entity extraction
  - Confidence scoring
  - Request routing

- **Service Registry** (`service-registry.test.ts`)
  - Service registration
  - Service discovery
  - Health checks
  - Load balancing

### Frontend Unit Tests (Vitest)

Located in: `apps/frontend/src/`

#### Components
- **Chat Interface** (`components/__tests__/ChatInterface.test.tsx`)
- **Tool Switcher** (`components/__tests__/ToolSwitcher.test.tsx`)
- **Graphics Editor** (`components/__tests__/GraphicsEditor.test.tsx`)
- **Preview Panel** (`components/__tests__/PreviewPanel.test.tsx`)

#### State Management
- **Auth Slice** (`store/__tests__/authSlice.test.ts`)

#### Services
- **API Service** (`services/__tests__/api.service.test.ts`)
- **Export Service** (`services/__tests__/export.service.test.ts`)

#### Hooks
- **useWebSocket** (`hooks/__tests__/useWebSocket.test.ts`)
- **useResponsive** (`hooks/__tests__/useResponsive.test.ts`)

#### Utilities
- **Validation** (`utils/__tests__/validation.test.ts`)

## Integration Tests

### Backend Integration Tests

Located in: `apps/backend/tests/integration/`

#### Authentication Flow (`auth.integration.test.ts`)
- User registration
- User login
- Token refresh
- Profile access
- Logout

#### WebSocket Communication (`websocket.integration.test.ts`)
- Real-time messaging
- Authentication
- Tool switching
- Error handling
- Connection management

### Service Integration
- API Gateway routing
- Service registry integration
- NLP processing pipeline
- Inter-service communication

## End-to-End Tests

### Playwright Test Suite

Located in: `e2e/`

#### Authentication (`auth.spec.ts`)
- Login page display
- Registration flow
- OAuth integration
- Validation errors
- Session management

#### Chat Interface (`chat.spec.ts`)
- Message sending
- Typing indicators
- Conversation history
- File attachments
- Context preservation

#### Creative Tools

**Graphics Tool** (`graphics-tool.spec.ts`)
- Canvas creation
- Shape drawing
- Object manipulation
- Export functionality
- Undo/Redo

**Web Designer** (`web-designer-tool.spec.ts`)
- Page generation
- Responsive preview
- Code editing
- Component library
- WCAG compliance

**Code IDE** (`ide-tool.spec.ts`)
- Project creation
- Code execution
- Multi-language support
- Syntax validation
- Security scanning

**CAD Tool** (`cad-tool.spec.ts`)
- 3D model creation
- Object transformation
- Camera views
- Measurements
- Export formats

**Video Tool** (`video-tool.spec.ts`)
- Video upload
- Timeline editing
- Effects application
- Rendering
- Transitions

#### Cross-Browser Testing
Configured in `playwright.config.ts`:
- Chrome (Desktop)
- Firefox (Desktop)
- Safari (Desktop)
- Mobile Chrome
- Mobile Safari

#### Responsive Testing
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

## Performance Tests

### K6 Test Suite

Located in: `tests/performance/`

#### Load Testing (`api-load-test.js`)
- Ramp up to 100 users
- Stay at 100 users for 5 minutes
- Ramp up to 200 users
- Measure response times
- Track error rates

**Thresholds:**
- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 10%

#### Stress Testing (`stress-test.js`)
- Ramp up to 400 users
- Sustained high load
- Beyond normal capacity
- System breaking point identification

#### WebSocket Testing (`websocket-test.js`)
- Concurrent connections
- Message throughput
- Connection stability
- Reconnection handling

#### Rate Limiting (`rate-limit-test.js`)
- 100 requests/minute limit
- Burst traffic handling
- Header validation
- Bypass prevention

### Running Performance Tests

```bash
# Set environment
export BASE_URL=http://localhost:3000
export WS_URL=ws://localhost:3000/ws

# Run tests
npm run test:performance
npm run test:stress
npm run test:websocket
npm run test:rate-limit

# With custom options
k6 run --vus 100 --duration 5m tests/performance/api-load-test.js
```

## Security Tests

### OWASP Top 10 Coverage

Located in: `apps/backend/tests/security/`

#### A01: Broken Access Control
- Unauthorized access prevention
- Privilege escalation detection
- Direct object reference protection

#### A02: Cryptographic Failures
- Password hashing verification
- JWT algorithm validation
- HTTPS enforcement

#### A03: Injection Attacks
- SQL injection prevention
- NoSQL injection testing
- Command injection prevention

#### A04: Insecure Design
- Rate limiting verification
- Error handling validation

#### A05: Security Misconfiguration
- Security headers validation
- Stack trace exposure check
- Information disclosure prevention

#### A07: Authentication Failures
- Password strength enforcement
- Account lockout testing
- Session management validation

#### A08: Software Integrity Failures
- Data validation
- Input sanitization

#### A10: SSRF
- URL validation
- Request validation

### Specific Security Tests

#### SQL Injection (`sql-injection.test.ts`)
- Email field injection
- Password field injection
- Query parameter injection
- Message content injection

#### XSS Prevention (`xss.test.ts`)
- Script tag sanitization
- Event handler blocking
- HTML entity encoding
- CSP header validation

#### Rate Limiting (`rate-limit.test.ts`)
- Login rate limiting
- Registration rate limiting
- Chat message rate limiting
- Bypass attempt detection

## Continuous Integration

### GitHub Actions Workflow

`.github/workflows/test.yml`

#### Pipeline Stages

1. **Unit Tests**
   - Install dependencies
   - Setup test database
   - Run unit tests
   - Generate coverage

2. **End-to-End Tests**
   - Build application
   - Start services
   - Run Playwright tests
   - Upload reports

3. **Performance Tests**
   - Load testing
   - Stress testing
   - Threshold validation

4. **Security Tests**
   - Security unit tests
   - OWASP ZAP scan

5. **Lint & Format**
   - ESLint validation
   - Prettier formatting check

#### CI Configuration

```yaml
# Key features
- Parallel job execution
- Coverage reporting to Codecov
- Artifact retention
- Failure notification
- Browser matrix testing
```

## Best Practices

### Writing Tests

#### Unit Tests
1. **Follow AAA Pattern**
   - Arrange: Set up test data
   - Act: Execute the function
   - Assert: Verify the outcome

2. **Use Descriptive Names**
   ```typescript
   it('should return 401 for missing authorization header', () => {
     // Test implementation
   });
   ```

3. **Test One Thing at a Time**
   - One assertion per test
   - Clear test purpose

4. **Mock External Dependencies**
   - Use Jest mocks for services
   - Mock API calls
   - Isolate units under test

#### Integration Tests
1. **Test Real Interactions**
   - Use actual HTTP requests
   - Test database operations
   - Verify end-to-end flows

2. **Setup and Teardown**
   - Clean database before tests
   - Close connections after tests
   - Reset state between tests

#### E2E Tests
1. **User-Centric**
   - Test complete user journeys
   - Verify real workflows
   - Focus on critical paths

2. **Stable Selectors**
   - Use data-testid attributes
   - Avoid brittle CSS selectors
   - Maintain test stability

#### Performance Tests
1. **Realistic Scenarios**
   - Match production traffic
   - Use real user patterns
   - Test peak conditions

2. **Threshold-Based**
   - Define success criteria
   - Monitor degradation
   - Set alerts

### Test Organization

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── performance/      # Performance tests
├── security/         # Security tests
└── fixtures/         # Test data
```

### Coverage Exclusions

- Test files themselves
- Build outputs
- Third-party code
- Configuration files
- Type definitions

### Continuous Improvement

1. **Review Test Results**
   - Analyze failures
   - Identify flakiness
   - Improve coverage

2. **Update Tests**
   - Keep tests current
   - Refactor when needed
   - Remove obsolete tests

3. **Monitor Trends**
   - Track coverage over time
   - Monitor performance
   - Review security posture

## Troubleshooting

### Common Issues

**Tests Timing Out**
- Increase timeout values
- Check async operations
- Verify test isolation

**Flaky Tests**
- Fix race conditions
- Improve wait strategies
- Add proper cleanup

**Coverage Gaps**
- Identify untested code
- Add missing tests
- Review test quality

### Debugging

```bash
# Verbose output
npm run test -- --verbose

# Run specific test
npm run test -- --testNamePattern="should login"

# Debug mode
npm run test -- --inspect-brk

# Frontend tests in watch mode
npm run test:frontend -- --watch
```

## References

- [Jest Documentation](https://jestjs.io/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [K6 Documentation](https://k6.io/docs/)
- [Testing Library](https://testing-library.com/)
- [OWASP Testing Guide](https://owasp.org/www-project-testing/)

## Support

For questions or issues:
- Check test logs
- Review CI artifacts
- Contact QA team
- Open GitHub issue

---

**Last Updated:** 2025-11-06
**Version:** 1.0.0

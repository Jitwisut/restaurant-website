# Backend Testing Guide

## Overview

This document provides comprehensive guidance for running and maintaining the test suite for the restaurant backend API built with Elysia.js and Bun.

## Test Structure

```
src/
  __tests__/
    helpers/
      testUtils.ts         # Helper functions and test data generators
    integration/
      api.test.ts         # Integration tests for complete API flows
    setup.ts              # Test database configuration and setup
    auth.test.ts          # Authentication controller tests
    admin.test.ts         # Admin controller tests
    menu.test.ts          # Menu controller tests
    table.test.ts         # Table controller tests
    order.test.ts         # Order controller tests
    profile.test.ts       # Profile controller tests
```

## Running Tests

### Run All Tests

```bash
cd e:\restaurant-website\app
bun test
```

### Run Tests in Watch Mode

```bash
bun test:watch
```

### Run Specific Test File

```bash
# Run only auth tests
bun test src/__tests__/auth.test.ts

# Run only integration tests
bun test src/__tests__/integration/api.test.ts
```

### Run Tests with Filter

```bash
# Run tests matching a pattern
bun test --test-name-pattern "should successfully login"
```

## Test Coverage

### Current Test Coverage

- **Auth Controller**: ✅ Signin, Signup, Role-based redirects, Error handling
- **Admin Controller**: ✅ User management (CRUD), Menu upload, Data validation
- **Menu Controller**: ✅ Menu retrieval, Image encoding, Data structure validation
- **Table Controller**: ✅ Open/Close tables, QR code generation, Session management
- **Order Controller**: ✅ Order history, Aggregation, Data validation
- **Profile Controller**: ✅ Profile retrieval, JWT validation, Role verification
- **Integration**: ✅ Complete flows, CORS, Error handling, Authentication chains

### Total Tests

- **Unit Tests**: 80+ test cases
- **Integration Tests**: 15+ test scenarios
- **Total Coverage**: All major API endpoints and business logic

## Test Database Setup

Tests use PostgreSQL for consistency with production. You can configure the test database using environment variables:

```bash
# .env.test
DB_USER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_PASSWORD=postgres
TEST_DB_NAME=restaurant_test
JWT_SECRET=test-secret-key
```

### Database Schema

The test database automatically creates the following tables:
- `users` - User accounts and authentication
- `menu_new` - Menu items with images
- `tables` - Restaurant tables
- `sessions` - Table sessions
- `orders` - Customer orders
- `order_items` - Order line items

## Writing New Tests

### Example: Testing a New Controller

```typescript
import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { YourRouter } from "../router/YourRouter";

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";

const createTestApp = () => {
  return new Elysia()
    .use(jwt({ name: "jwt", secret: jwtsecret }))
    .use(YourRouter);
};

describe("Your Controller", () => {
  test("should do something", async () => {
    const app = createTestApp();
    
    const response = await app.handle(
      new Request("http://localhost/your-endpoint", {
        method: "GET",
      })
    );
    
    expect(response.status).toBe(200);
  });
});
```

### Using Test Helpers

```typescript
import { createTestUser, createMockImageFile } from "./helpers/testUtils";

// Create test user data
const user = createTestUser({
  username: "custom_user",
  role: "admin",
});

// Create mock image for upload tests
const image = createMockImageFile("photo.jpg");
```

## Common Test Patterns

### Testing Authentication

```typescript
// 1. Create user
await app.handle(
  new Request("http://localhost/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, role }),
  })
);

// 2. Login
const signinResponse = await app.handle(
  new Request("http://localhost/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
);

const { token } = await signinResponse.json();

// 3. Use token for authenticated requests
const response = await app.handle(
  new Request("http://localhost/profile/getprofile", {
    method: "GET",
    headers: { Cookie: `auth=${token}` },
  })
);
```

### Testing Error Cases

```typescript
test("should reject invalid input", async () => {
  const app = createTestApp();
  
  const response = await app.handle(
    new Request("http://localhost/endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ /* invalid data */ }),
    })
  );
  
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.message).toContain("error");
});
```

### Testing with Time-based Data

```typescript
// Use timestamps to ensure unique data
const username = `test_${Date.now()}`;
const email = `test_${Date.now()}@example.com`;
```

## Best Practices

### 1. **Isolation**
- Each test should be independent
- Use unique identifiers (timestamps) to avoid conflicts
- Clean up resources after tests

### 2. **Descriptive Names**
- Use clear, descriptive test names
- Follow pattern: "should [expected behavior] when [condition]"

### 3. **Comprehensive Coverage**
- Test happy paths (successful operations)
- Test error cases (invalid input, missing data)
- Test edge cases (boundary conditions)

### 4. **Fast Execution**
- Keep tests focused and fast
- Mock external dependencies when possible
- Use in-memory databases for unit tests

### 5. **Maintainability**
- Use helper functions for common operations
- Keep test code DRY (Don't Repeat Yourself)
- Update tests when API changes

## Debugging Tests

### View Test Output

```bash
# Run with verbose output
bun test --verbose

# Run specific failing test
bun test src/__tests__/auth.test.ts --test-name-pattern "failing test name"
```

### Common Issues

**Issue**: Database connection errors
- **Solution**: Check DATABASE_URL and test database exists

**Issue**: Token validation failures
- **Solution**: Verify JWT_SECRET matches between app and tests

**Issue**: Race conditions
- **Solution**: Use unique identifiers (timestamps) for test data

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```

## Contributing

When adding new features:

1. ✅ Write tests before implementation (TDD)
2. ✅ Ensure all tests pass
3. ✅ Add integration tests for new flows
4. ✅ Update this documentation if needed

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Elysia Documentation](https://elysiajs.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/write-tests)

---

**Last Updated**: January 2026  
**Maintainer**: Restaurant Backend Team

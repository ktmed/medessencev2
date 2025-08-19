# BACKEND/FULLSTACK DEVELOPER HAT

## Core Mission

When I wear the Backend/Fullstack hat, I build the engine that powers the application. I ensure data integrity, business logic correctness, and system reliability.

## Key Responsibilities

1. **API Design & Implementation**
   ```javascript
   // RESTful endpoint example
   router.post('/api/users', 
     validateInput(userSchema),
     authenticate,
     authorize('user:create'),
     async (req, res) => {
       try {
         const user = await userService.create(req.body);
         res.status(201).json({ data: user });
       } catch (error) {
         handleError(error, res);
       }
     }
   );
   ```

2. **Database Schema Design**
   ```sql
   -- Think relationships and future queries
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email VARCHAR(255) UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX idx_users_email ON users(email);
   ```

3. **Business Logic Implementation**
   - Service layer pattern
   - Transaction management
   - Domain model validation
   - Side effect handling

4. **Integration Management**
   - Third-party APIs
   - Payment processing
   - Email services
   - File storage
   - Queue systems

## Architecture Patterns

### Service Layer
```javascript
class UserService {
  async create(userData) {
    // Validation
    const validated = await this.validate(userData);
    
    // Business rules
    if (await this.emailExists(validated.email)) {
      throw new ConflictError('Email already exists');
    }
    
    // Transaction
    return await db.transaction(async (trx) => {
      const user = await trx.users.create(validated);
      await this.sendWelcomeEmail(user);
      await this.logUserCreation(user);
      return user;
    });
  }
}
```

### Error Handling
```javascript
// Centralized error handling
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// Usage
if (!user) {
  throw new AppError('User not found', 404, 'USER_NOT_FOUND');
}
```

### Authentication & Authorization
```javascript
// JWT with refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

## Data Management

### Query Optimization
- Use indexes strategically
- Avoid N+1 queries
- Pagination for large datasets
- Selective field queries
- Connection pooling

### Caching Strategy
```javascript
// Cache-aside pattern
async function getUser(id) {
  // Check cache
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  
  // Fetch from DB
  const user = await db.users.findById(id);
  
  // Cache for next time
  await redis.setex(`user:${id}`, 3600, JSON.stringify(user));
  
  return user;
}
```

## Security Considerations

### Input Validation
```javascript
const userSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
  name: joi.string().max(100).required()
});
```

### SQL Injection Prevention
```javascript
// Always use parameterized queries
const users = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

### Rate Limiting
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
  message: 'Too many requests'
});
```

## Testing Strategy

### Unit Tests
```javascript
describe('UserService', () => {
  it('should create user with hashed password', async () => {
    const userData = { email: 'test@example.com', password: 'password123' };
    const user = await userService.create(userData);
    
    expect(user.email).toBe(userData.email);
    expect(user.password).not.toBe(userData.password);
    expect(bcrypt.compare(userData.password, user.password)).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'new@example.com', password: 'password123' })
      .expect(201);
      
    expect(response.body.data).toHaveProperty('id');
  });
});
```

## Performance Optimization

1. **Database**
   - Connection pooling
   - Query optimization
   - Proper indexing
   - Batch operations

2. **Application**
   - Async/await properly
   - Stream large files
   - Background job processing
   - Memory leak prevention

3. **API**
   - Response compression
   - Field filtering
   - Pagination
   - HTTP caching headers

## Example Implementation

"Implement user registration with email verification"

**Backend Approach:**
1. **API Endpoint**: POST /api/auth/register
2. **Flow**:
   ```javascript
   async function register(userData) {
     // Validate input
     const validated = await validateRegistration(userData);
     
     // Check existing
     if (await userExists(validated.email)) {
       throw new ConflictError('Email already registered');
     }
     
     // Create user (inactive)
     const user = await createUser({
       ...validated,
       isActive: false,
       verificationToken: generateToken()
     });
     
     // Send verification email
     await emailService.sendVerification(user);
     
     return { message: 'Please check your email to verify account' };
   }
   ```
3. **Security**: Hash passwords, secure tokens, rate limit
4. **Error handling**: Graceful failures, clear messages
5. **Testing**: Unit + integration tests

## Common Pitfalls

- Not handling concurrent requests
- Forgetting to validate inputs
- Exposing sensitive data in responses
- Poor error messages
- No request logging
- Ignoring CORS in development
- Hardcoding configurations

Remember: The backend is the foundation. Build it solid, secure, and scalable. Bad frontend UX annoys users; bad backend loses their data forever.
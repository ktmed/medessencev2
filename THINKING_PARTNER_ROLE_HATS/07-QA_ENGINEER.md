# QA ENGINEER HAT

## Core Philosophy

When I wear the QA hat, I become the user's last line of defense. I think like a user who's having their worst day - everything that can go wrong, will go wrong.

## Testing Mindset

1. **Break Everything**
   - If it can be broken, find how
   - Edge cases are my specialty
   - "Happy path" is just the beginning
   - Assume users will do the unexpected

2. **Think Like Different Users**
   - Power user with keyboard shortcuts
   - Grandma's first time online
   - Impatient user on slow connection
   - Malicious actor trying to break in

3. **Quality Metrics**
   - Functionality: Does it work?
   - Reliability: Does it always work?
   - Usability: Is it easy to use?
   - Performance: Is it fast enough?
   - Security: Is it safe?

## Testing Strategy

### Test Pyramid
```
         /\
        /  \    E2E Tests (10%)
       /----\   
      /      \  Integration Tests (30%)
     /--------\
    /          \ Unit Tests (60%)
   /____________\
```

### Test Types & Focus

1. **Unit Tests**
   ```javascript
   // Test individual functions
   test('calculateDiscount applies percentage correctly', () => {
     expect(calculateDiscount(100, 20)).toBe(80);
     expect(calculateDiscount(100, 0)).toBe(100);
     expect(calculateDiscount(100, 100)).toBe(0);
   });
   ```

2. **Integration Tests**
   ```javascript
   // Test component interactions
   test('user can complete checkout flow', async () => {
     await addToCart(product);
     await goToCheckout();
     await fillPaymentInfo(validCard);
     await submitOrder();
     
     expect(getOrderConfirmation()).toBeTruthy();
   });
   ```

3. **E2E Tests**
   ```javascript
   // Test full user journeys
   test('new user can register and make first purchase', async () => {
     await page.goto('/register');
     await page.fill('[name=email]', 'test@example.com');
     // ... complete flow
   });
   ```

## Edge Cases Checklist

### Input Validation
- Empty values
- Maximum length + 1
- Special characters (!@#$%^&*)
- Unicode/emoji 🚀
- SQL injection attempts
- XSS attempts
- Negative numbers where positive expected
- Decimals where integers expected

### State Management
- Double-clicking submit buttons
- Back button after submission
- Multiple tabs open
- Session timeout mid-action
- Network disconnection
- Concurrent modifications

### Performance Testing
- 1000+ items in a list
- Large file uploads
- Slow network (3G simulation)
- Multiple simultaneous users
- Memory leaks over time
- API rate limiting

## Bug Reporting Excellence

### Good Bug Report
```markdown
**Title**: Cart total shows NaN when applying 100% discount code

**Environment**: Production, Chrome 95, Windows 10

**Steps to Reproduce**:
1. Add item ($50) to cart
2. Apply discount code "FREEBIE" (100% off)
3. View cart summary

**Expected**: Total shows $0.00
**Actual**: Total shows NaN

**Impact**: Users cannot complete checkout with 100% discount
**Workaround**: None found

**Screenshots**: [attached]
**Console errors**: TypeError: Cannot read property 'toFixed' of NaN
```

## Testing Priorities

### Critical Path First
1. User registration/login
2. Core business functionality
3. Payment processing
4. Data integrity
5. Security vulnerabilities

### Risk-Based Testing
- High usage areas
- Recently changed code
- Complex logic
- Integration points
- Previous bug hotspots

## Automation Strategy

### What to Automate
- Repetitive test cases
- Regression tests
- Smoke tests
- API testing
- Performance benchmarks

### What to Test Manually
- Usability issues
- Visual bugs
- Exploratory testing
- New features (initially)
- Complex user journeys

## Common Issues I Find

1. **Validation Gaps**
   - Client-side only validation
   - Inconsistent error messages
   - Missing boundary checks

2. **State Issues**
   - Stale data after updates
   - Race conditions
   - Memory leaks
   - Orphaned records

3. **UX Problems**
   - No loading indicators
   - Poor error messages
   - Missing confirmations
   - Unclear next steps

4. **Performance**
   - N+1 queries
   - Unoptimized images
   - Blocking operations
   - Memory bloat

## QA Environment Needs

- Isolated test environment
- Test data management
- Environment reset capability
- Performance monitoring
- Error tracking
- Test user accounts

## Example Test Scenario

"Test user profile update feature"

**QA Approach:**

1. **Functional Tests**
   - Update each field individually
   - Update all fields at once
   - Cancel mid-edit
   - Invalid data in each field

2. **Edge Cases**
   - 500 character name
   - Profile photo 50MB
   - Simultaneous updates
   - Expired session during edit

3. **Integration**
   - Updates reflect everywhere
   - Email notification sent
   - Audit log created
   - Cache invalidated

4. **Performance**
   - Update time < 2 seconds
   - Photo upload progress shown
   - No UI freeze during save

5. **Security**
   - Can't update other users
   - XSS in bio field
   - CSRF protection active

Remember: Quality is not just finding bugs - it's preventing them from reaching users. Every bug caught saves user trust and developer time.
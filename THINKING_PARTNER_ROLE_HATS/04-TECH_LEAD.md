# TECH LEAD HAT

## Core Mission

When I wear the Tech Lead hat, I make architectural decisions that balance immediate delivery with long-term sustainability. I'm the bridge between business needs and technical reality.

## Key Decisions

1. **Technology Stack Selection**
   - Match team expertise
   - Community support & documentation
   - Performance requirements
   - Scaling considerations
   - Maintenance burden

2. **Folder Structure & Architecture**
   ```
   src/
   ├── components/     # Reusable UI components
   ├── features/       # Feature-based modules
   ├── services/       # External integrations
   ├── utils/          # Shared utilities
   ├── types/          # TypeScript interfaces
   └── config/         # Configuration files
   ```

3. **Architecture Patterns**
   - Monolith vs. Microservices (start monolith!)
   - Layered architecture
   - Event-driven where appropriate
   - Clear separation of concerns
   - Dependency injection

4. **Technical Standards**
   - Code style guide
   - Git workflow (GitFlow vs. GitHub Flow)
   - Testing requirements
   - Documentation standards
   - Review process

## Critical Early Decisions

### Database Choice
- **PostgreSQL**: Default for most apps (ACID, JSON support)
- **MongoDB**: Only if truly document-oriented
- **Redis**: Caching and sessions
- **SQLite**: Local development and small apps

### API Design
- RESTful by default
- GraphQL only if multiple clients with different needs
- Consistent naming conventions
- Versioning strategy from day one
- Authentication/authorization approach

### Frontend Architecture
- **React/Next.js**: Full-stack capabilities
- **Vue/Nuxt**: Simpler learning curve
- **Plain JavaScript**: For simple needs
- State management only when needed

## Scalability Considerations

**Start simple, but don't paint yourself into corners:**

1. **Database**
   - Use UUIDs, not auto-increment IDs
   - Plan for read replicas
   - Avoid tight coupling

2. **Caching**
   - Cache-friendly URL structure
   - CDN-ready static assets
   - Redis for session/app cache

3. **Background Jobs**
   - Queue system from start (even if simple)
   - Idempotent job design
   - Monitoring and retries

4. **Monitoring**
   - Structured logging from day one
   - Error tracking (Sentry)
   - Performance monitoring
   - Health checks

## Team Considerations

- **Current skills**: Don't introduce 5 new technologies
- **Hiring pool**: Can we find developers?
- **Learning curve**: How fast can team ramp up?
- **Bus factor**: Avoid single points of knowledge

## Example Architecture Decision

"Should we use microservices?"

**Tech Lead Analysis:**
- Team size: 5 developers → NO
- Clear bounded contexts? → Maybe 2-3
- Deployment complexity → High for small team
- Performance needs → Monolith is faster
- **Decision**: Modular monolith with clear boundaries
- **Future**: Can extract services when team > 15

## Technical Debt Management

### Acceptable Debt
- Hardcoded configs (early stage)
- Missing tests for prototypes
- Simple implementations that work

### Unacceptable Debt
- No error handling
- Security vulnerabilities
- Unscalable data models
- No deployment process

## Code Review Focus

1. **Architecture violations**
2. **Security issues**
3. **Performance problems**
4. **Maintainability concerns**
5. **Missing tests for critical paths**

## Anti-Patterns to Avoid

- Over-engineering for imagined scale
- Under-engineering core abstractions
- Technology for technology's sake
- Ignoring team feedback
- Perfect being enemy of good

Remember: The best architecture is the one that lets you ship features today while being able to evolve tomorrow. Choose boring technology and execute well.
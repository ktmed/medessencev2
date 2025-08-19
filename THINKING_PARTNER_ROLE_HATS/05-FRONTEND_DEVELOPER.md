# FRONTEND DEVELOPER HAT

## Core Focus

When I wear the Frontend Developer hat, I transform designs into living, breathing interfaces. I obsess over user experience, performance, and maintainability.

## Implementation Priorities

1. **Wireframe to Working UI**
   - Start with semantic HTML structure
   - Mobile-first responsive design
   - Progressive enhancement
   - Accessibility baked in, not bolted on

2. **Component Architecture**
   ```javascript
   // Prefer composition over complexity
   <Card>
     <CardHeader title="User Profile" />
     <CardBody>
       <UserInfo user={user} />
     </CardBody>
     <CardFooter>
       <Button onClick={handleSave}>Save</Button>
     </CardFooter>
   </Card>
   ```

3. **State Management**
   - Local state first (useState)
   - Context for cross-cutting concerns
   - External store only when truly needed
   - URL as state when appropriate

4. **Performance Optimization**
   - Lazy loading and code splitting
   - Image optimization (WebP, srcset)
   - Debouncing user inputs
   - Virtual scrolling for long lists
   - Web Vitals monitoring

## Development Workflow

### From Design to Code
1. Break design into components
2. Identify shared patterns
3. Build static version first
4. Add interactivity layer by layer
5. Connect to real data
6. Polish animations and transitions

### Component Guidelines
- Single responsibility
- Props interface clearly defined
- Composition over configuration
- Storybook for documentation
- Unit tests for logic
- Visual regression tests

## Technical Considerations

### Browser Compatibility
- Modern browsers baseline
- Progressive enhancement for older
- Polyfills only when necessary
- Feature detection, not browser detection

### Performance Budget
- Initial load: < 3s on 3G
- Time to Interactive: < 5s
- Bundle size: < 200KB gzipped
- Lighthouse score: > 90

### Responsive Design
```css
/* Mobile First */
.container {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

## Common Patterns

### Form Handling
```javascript
// Controlled components with validation
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  const validation = validateForm(formData);
  
  if (validation.isValid) {
    await submitForm(formData);
  } else {
    setErrors(validation.errors);
  }
};
```

### Data Fetching
```javascript
// Custom hook for data fetching
function useApiData(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData(endpoint)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [endpoint]);

  return { data, loading, error };
}
```

## Debugging Priorities

1. **Console errors/warnings** - Zero tolerance
2. **Network failures** - Graceful degradation
3. **Performance issues** - Profile first
4. **Cross-browser bugs** - Test early
5. **Accessibility issues** - Automated testing

## Example Implementation

"Implement infinite scroll for product list"

**Frontend Dev Approach:**
1. **Performance first**: Virtual scrolling or pagination?
2. **UX considerations**: Loading states, error handling
3. **Implementation**:
   ```javascript
   const useInfiniteScroll = (callback) => {
     const observer = useRef();
     const lastElementRef = useCallback(node => {
       if (loading) return;
       if (observer.current) observer.current.disconnect();
       
       observer.current = new IntersectionObserver(entries => {
         if (entries[0].isIntersecting && hasMore) {
           callback();
         }
       });
       
       if (node) observer.current.observe(node);
     }, [loading, hasMore, callback]);
     
     return lastElementRef;
   };
   ```
4. **Edge cases**: Network errors, end of list, refresh
5. **Accessibility**: Announce new items to screen readers

## Code Quality Checklist

- [ ] Components are reusable and composable
- [ ] No inline styles (except dynamic values)
- [ ] Event handlers are optimized (useCallback)
- [ ] Images have alt text
- [ ] Forms are keyboard accessible
- [ ] Loading and error states handled
- [ ] No memory leaks
- [ ] CSS is scoped appropriately

## Anti-Patterns to Avoid

- Direct DOM manipulation in React
- Inline functions in render
- Uncontrolled components without reason
- CSS-in-JS for static styles
- Over-fetching data
- Premature optimization
- Ignoring SEO needs

Remember: The best UI is one users don't have to think about. Fast, accessible, and intuitive beats pretty every time.
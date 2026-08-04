---
name: Button asChild pattern
description: Use React.cloneElement for asChild, not @radix-ui/react-slot — Slot causes duplicate React copy error in this Vite setup
---

In artifacts/mad-max, @radix-ui/react-slot causes a runtime crash: "Cannot read properties of null (reading 'useCallback')" — this is a duplicate React instance error triggered by Slot's useComposedRefs.

**Working pattern (artifacts/mad-max/src/components/ui/button.tsx):**
```typescript
if (asChild && React.isValidElement(children)) {
  const child = children as React.ReactElement<any>
  return React.cloneElement(child, {
    ...props,
    className: cn(classes, child.props.className),
  })
}
```

**Why:** The Vite dep optimization loads @radix-ui/react-slot with its own React copy when it's a devDependency. React.cloneElement uses the same React instance as the app.

**How to apply:** Any new UI primitive that needs asChild should use this React.cloneElement pattern, not Slot.

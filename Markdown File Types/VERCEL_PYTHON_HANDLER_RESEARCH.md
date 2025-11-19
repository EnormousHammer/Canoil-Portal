# Vercel Python Handler Research & Fix

## 🔍 Research Findings

Based on Vercel Python runtime documentation and Flask WSGI requirements:

### Vercel Python Function Format

Vercel Python functions use the `@vercel/python` runtime which:
1. Looks for a `handler` function in `api/*.py` files
2. Passes a request object (dict or object) to the handler
3. Expects a response dict with `statusCode`, `headers`, `body`

### Request Format

The request object can be:
- A dict with keys: `path`, `method`, `headers`, `body`, `query`
- An object with attributes: `path`, `method`, `headers`, `body`, `query`

### Common Issues

1. **Import Errors**: Flask app fails to import due to missing dependencies or path issues
2. **WSGI Environment**: Incorrect WSGI environment setup
3. **Path Handling**: Path routing issues between Vercel and Flask
4. **sys.stdout/stderr**: Wrapping stdout/stderr can cause issues on Vercel

## 🔧 Fix Strategy

1. **Lazy Import**: Don't import Flask app at module level - import in handler
2. **Better Error Handling**: Catch and log all errors clearly
3. **Path Normalization**: Handle path routing correctly
4. **Conditional stdout/stderr**: Only wrap if not on Vercel


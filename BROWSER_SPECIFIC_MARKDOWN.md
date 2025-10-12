# Browser-Specific Markdown Rendering Implementation

## Overview
This document describes the implementation of browser-specific markdown library loading in the AskHole application. The system detects Safari browsers and uses compatible older versions of remark-gfm, while other browsers use the latest versions.

## Implementation Details

### Package Dependencies

#### Updated package.json
- **react-markdown**: Upgraded from `8.0.7` to `^9.0.1` (latest)
- **remark-gfm**: Upgraded from `2.0.0` to `^4.0.0` (latest)
- **remark-gfm-safari**: Added as alias `npm:remark-gfm@2.0.0` (Safari-compatible version)

The npm package alias feature allows us to install the same package under different names:
```json
"remark-gfm": "^4.0.0",
"remark-gfm-safari": "npm:remark-gfm@2.0.0"
```

### Browser Detection

#### Safari Detection Function
Located in: `frontend/src/components/MessageList.jsx`

```javascript
const detectSafari = useCallback(() => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  // Detect Safari but exclude Chrome/Chromium-based browsers
  const isSafariBrowser = /safari/.test(userAgent) &&
                         !/chrome|chromium|crios|edg|brave|opera|opr/.test(userAgent);
  return isSafariBrowser;
}, []);
```

This function:
- Checks for Safari in the user agent string
- Explicitly excludes Chromium-based browsers (Chrome, Edge, Brave, Opera)
- Excludes Chrome for iOS (CriOS)
- Returns `true` only for genuine Safari browsers

### Dynamic Plugin Loading

#### Plugin Loading Logic
```javascript
useEffect(() => {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
  const safariDetected = detectSafari();

  setIsMobileDevice(isMobile);
  setIsSafari(safariDetected);

  const loadPlugins = async () => {
    try {
      // Use older remark-gfm version for Safari, newer version for other browsers
      if (safariDetected) {
        console.log('Safari detected - loading compatible remark-gfm version 2.0.0');
        const remarkGfmSafari = await import('remark-gfm-safari');
        setRemarkPlugins([remarkGfmSafari.default]);
      } else {
        console.log('Non-Safari browser detected - loading latest remark-gfm version');
        const remarkGfm = await import('remark-gfm');
        setRemarkPlugins([remarkGfm.default]);
      }
    } catch (error) {
      console.warn(t('failed_to_load_markdown_plugins'), error);
    }
  };

  loadPlugins();
}, [t, detectSafari]);
```

### Table Styling Improvements

#### Enhanced Visual Contrast
Located in: `frontend/src/index.css`

The markdown tables now have:
1. **Container styling**: Border, border-radius, background color, and box shadow
2. **Improved borders**: Stronger header border (2px), visible cell borders
3. **Better backgrounds**: Distinct header background color, card background for cells
4. **Scroll indicators**: Gradient overlays that appear when content is scrollable
5. **Visible scrollbar**: Custom styled scrollbar for WebKit browsers

#### Scroll Detection
JavaScript code in `MessageList.jsx` detects when tables are scrollable and adds classes:
- `scrollable-left`: Shows left gradient when not at the start
- `scrollable-right`: Shows right gradient when not at the end

## Benefits

### Performance
- Modern browsers get the latest optimized versions
- Safari gets stable, compatible versions
- Dynamic imports mean only one version is loaded per session

### Compatibility
- Ensures Safari users have a working experience
- Other browsers benefit from latest features and bug fixes
- No breaking changes for end users

### Maintainability
- Clear separation of concerns
- Easy to update versions independently
- Console logging helps with debugging

## Testing

### How to Test
1. Open the application in different browsers
2. Check the browser console for loading messages:
   - Safari: "Safari detected - loading compatible remark-gfm version 2.0.0"
   - Others: "Non-Safari browser detected - loading latest remark-gfm version"
3. Test markdown tables to ensure proper rendering
4. Verify scroll indicators appear on wide tables

### Test Cases
- ✅ Chrome/Edge/Brave: Should use remark-gfm 4.0.0
- ✅ Firefox: Should use remark-gfm 4.0.0
- ✅ Safari (macOS/iOS): Should use remark-gfm 2.0.0
- ✅ Tables should render with proper styling
- ✅ Scroll indicators should show when table overflows
- ✅ Scrollbar should be visible and styled

## Future Improvements

### Possible Enhancements
1. Add version display in settings/debug panel
2. Allow manual override of markdown library version
3. Add more granular browser/version detection
4. Create fallback for other browser-specific issues

### Version Management
When updating libraries:
1. Test in Safari first
2. Update `remark-gfm-safari` alias if Safari compatibility improves
3. Update main `remark-gfm` version for other browsers
4. Update `react-markdown` carefully, testing all features

## Installation

To install dependencies after cloning:

```bash
cd frontend
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is needed due to peer dependency conflicts with some packages.

## Troubleshooting

### Issue: Tables not rendering
- Check browser console for plugin loading errors
- Verify both remark-gfm versions are installed
- Ensure remarkPlugins array is properly set

### Issue: Wrong version loading
- Check Safari detection logic
- Verify user agent string in console
- Clear browser cache and reload

### Issue: Scroll indicators not appearing
- Check if table width exceeds container
- Verify scroll detection JavaScript is running
- Check CSS classes are being applied

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const placeholder = document.querySelector('.canvas-placeholder');
    const imageUpload = document.getElementById('imageUpload');
    const dropArea = document.getElementById('dropArea');
    const downloadPngBtn = document.getElementById('downloadPngBtn');

    // Controls
    const controlsPanel = document.querySelector('.controls-panel');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const saveSessionBtn = document.getElementById('saveSessionBtn');
    const loadSessionBtn = document.getElementById('loadSessionBtn');

    // Adjust Controls (CSS Filters)
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    const saturationSlider = document.getElementById('saturation');
    const hueRotateSlider = document.getElementById('hue-rotate');
    const adjustSliders = [brightnessSlider, contrastSlider, saturationSlider, hueRotateSlider];
    const resetAdjustmentsBtn = document.getElementById('resetAdjustments');

    // Draw Controls
    const drawToolSelect = document.getElementById('drawTool');
    const drawColorPicker = document.getElementById('drawColor');
    const brushSizeSlider = document.getElementById('brushSize');
    const brushSizeValueSpan = brushSizeSlider.nextElementSibling;

    // Text Controls
    const textInput = document.getElementById('textInput');
    const textColorPicker = document.getElementById('textColor');
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValueSpan = fontSizeSlider.nextElementSibling;
    const fontFamilySelect = document.getElementById('fontFamily');
    const addTextBtn = document.getElementById('addTextBtn');
    const textOverlay = document.getElementById('textOverlay');

    // Sticker Controls
    const stickerOptions = document.querySelectorAll('.sticker-option');
    const stickerOverlay = document.getElementById('stickerOverlay');
    const stickerOverlayImg = stickerOverlay.querySelector('img');


    // Crop Controls
    const cropOverlay = document.getElementById('cropOverlay');
    const startCropBtn = document.getElementById('startCropBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');


    // --- State ---
    let originalImage = null; // Store the original image data or object
    let currentImage = null; // Store the current image data (needed for some ops)
    let history = []; // Array to store canvas states (Data URLs or ImageData)
    let historyIndex = -1;
    let isDrawing = false;
    let currentTool = null; // 'draw', 'text', 'sticker', 'crop'
    let drawColor = '#000000';
    let brushSize = 5;
    let drawTool = 'brush'; // 'brush' or 'eraser'
    let textColor = '#000000';
    let fontSize = 30; // in pixels
    let fontFamily = 'Arial';

    // Crop State
    let isCropping = false;
    let cropRect = { x: 0, y: 0, width: 0, height: 0 };
    let startCropX = 0;
    let startCropY = 0;
    let isResizingCrop = false;
    let activeCropHandle = null; // Stores which handle is being dragged

    // Overlay State (for moving text/stickers before applying)
    let activeOverlay = null; // 'textOverlay' or 'stickerOverlay'
    let isDraggingOverlay = false;
    let overlayOffsetX, overlayOffsetY; // Mouse offset within the overlay element


    // --- History Management ---

    // Save current canvas state to history
    function saveState() {
        if (!currentImage) return; // Don't save if no image loaded

        // Use ImageData for better performance and pixel manipulation
        // Or DataURL for simpler saving/loading (larger data)
        // Let's use DataURL for simpler history storage in this example
        const dataUrl = canvas.toDataURL();

        // If we undid, remove future states before adding new one
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }

        // Add current state
        history.push(dataUrl);
        historyIndex++;

        // Keep history size reasonable (optional)
        // const maxHistorySize = 20;
        // if (history.length > maxHistorySize) {
        //     history.shift();
        //     historyIndex--;
        // }

        updateHistoryButtons();
        console.log(`History saved. Total states: ${history.length}, Current index: ${historyIndex}`);
    }

    // Restore canvas state from history
    function restoreState(index) {
        if (index >= 0 && index < history.length) {
            const img = new Image();
            img.onload = () => {
                // Ensure canvas matches size of the state being restored
                // This is crucial if cropping changed canvas size
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);

                // Resize main canvas and draw the restored state
                canvas.width = tempCanvas.width;
                canvas.height = tempCanvas.height;
                ctx.drawImage(tempCanvas, 0, 0);

                 // Update currentImage reference if needed for filters etc.
                // Or re-create it from the restored state if filters operate on currentImage
                 // For now, filters will operate directly on canvas data after loading state.
                // Let's clear currentImage and rely solely on canvas pixel data after restore.
                 currentImage = null; // Or load the current state into a new Image() if needed elsewhere

                // Hide overlays when history state changes
                hideOverlays();
                 isCropping = false;
                 applyCropBtn.disabled = true;
                 cancelCropBtn.disabled = true;

                placeholder.style.display = 'none'; // Hide placeholder once image is loaded/restored

                historyIndex = index;
                updateHistoryButtons();
                console.log(`State restored to index: ${historyIndex}`);
            };
            img.src = history[index];
        }
    }

    function undo() {
        if (historyIndex > 0) {
            restoreState(historyIndex - 1);
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            restoreState(historyIndex + 1);
        }
    }

    function updateHistoryButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    // --- Image Loading ---

    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Reset canvas size and draw image
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                originalImage = img; // Store original for potential reset or reference
                currentImage = img; // Start with the loaded image

                placeholder.style.display = 'none'; // Hide placeholder
                canvas.style.display = 'block'; // Show canvas

                // Reset history and save initial state
                history = [];
                historyIndex = -1;
                saveState();

                // Disable crop buttons until crop is started
                applyCropBtn.disabled = true;
                cancelCropBtn.disabled = true;

                // Apply saved adjustments if any from local storage (advanced)
                 applyCSSTransformations(); // Apply CSS filters visually
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Drag and Drop ---
    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropArea.classList.add('dragover');
    });

    dropArea.addEventListener('dragleave', (event) => {
        event.preventDefault();
        dropArea.classList.remove('dragover');
    });

    dropArea.addEventListener('drop', (event) => {
        event.preventDefault();
        dropArea.classList.remove('dragover');
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            loadImage(files[0]);
        }
    });

    // --- Tabs ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Hide overlays when switching tabs unless it's the active tool
            if (currentTool !== 'crop' && targetTab !== 'crop') hideOverlay(cropOverlay);
            if (currentTool !== 'text' && targetTab !== 'text') hideOverlay(textOverlay);
            if (currentTool !== 'sticker' && targetTab !== 'stickers') hideOverlay(stickerOverlay);

            // Update current tool based on the tab
            currentTool = targetTab === 'draw' ? 'draw' :
                          targetTab === 'text' ? 'text' :
                          targetTab === 'stickers' ? 'sticker' :
                          targetTab === 'crop' ? 'crop' : null;

             // Re-enable canvas drawing listeners if draw tab is active
             if (currentTool === 'draw') {
                 canvas.addEventListener('mousedown', startDrawing);
                 canvas.addEventListener('mousemove', draw);
                 canvas.addEventListener('mouseup', stopDrawing);
                 canvas.addEventListener('mouseout', stopDrawing); // Stop drawing if mouse leaves canvas
             } else {
                 // Remove drawing listeners if not in draw mode
                 canvas.removeEventListener('mousedown', startDrawing);
                 canvas.removeEventListener('mousemove', draw);
                 canvas.removeEventListener('mouseup', stopDrawing);
                 canvas.removeEventListener('mouseout', stopDrawing);
             }

             // Special handling for crop tab
             if (currentTool !== 'crop') {
                 isCropping = false; // Ensure cropping state is off
             }
        });
    });

    // --- Filters (Pixel Manipulation & CSS) ---

    // Apply a pixel-based filter
    function applyPixelFilter(filterName) {
        if (!currentImage) return;

        // Ensure canvas is showing the current state before getting data
        // If CSS filters are applied, we might need to render them first!
        // This is a complex point. For simplicity, assume canvas pixels are the source.
        // If you apply CSS filters for preview, you'd need a separate "Apply" step
        // that redraws to an offscreen canvas with styles applied, or implements
        // the filter in JS based on slider values.
        // Let's remove CSS filters before getting pixel data for pixel filters.
        canvas.style.filter = 'none';


        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let pixels = imageData.data; // Uint8ClampedArray [r, g, b, a, r, g, b, a, ...]

        const numPixels = pixels.length / 4; // Each pixel is 4 values (R, G, B, A)

        for (let i = 0; i < numPixels; i++) {
            const r = pixels[i * 4];
            const g = pixels[i * 4 + 1];
            const b = pixels[i * 4 + 2];
            // const a = pixels[i * 4 + 3]; // Alpha channel usually ignored for color filters

            let newR, newG, newB;

            switch (filterName) {
                case 'grayscale':
                    // Luminosity method: 0.2126*R + 0.7152*G + 0.0722*B
                    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    newR = newG = newB = gray;
                    break;
                case 'sepia':
                    newR = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
                    newG = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
                    newB = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
                    break;
                case 'invert':
                    newR = 255 - r;
                    newG = 255 - g;
                    newB = 255 - b;
                    break;
                // Basic Blur (Box Blur) - More complex to implement correctly
                // case 'blur':
                //     // This requires accessing neighbor pixels, which needs a separate pass
                //     // or reading from the *original* imageData while writing to a *new* one.
                //     // Skipping for simplicity in this basic version.
                //     break;
                default:
                    // No filter or unknown filter
                    newR = r; newG = g; newB = b;
            }

            pixels[i * 4] = newR;
            pixels[i * 4 + 1] = newG;
            pixels[i * 4 + 2] = newB;
            // Alpha channel pixels[i * 4 + 3] remains unchanged
        }

        ctx.putImageData(imageData, 0, 0); // Put the modified pixel data back

        saveState(); // Save the state after applying filter
    }

    // Apply CSS filters for visual adjustment preview
    function applyCSSTransformations() {
        const brightness = brightnessSlider.value;
        const contrast = contrastSlider.value;
        const saturation = saturationSlider.value;
        const hueRotate = hueRotateSlider.value;

        // Update span values
        brightnessSlider.nextElementSibling.textContent = `${brightness}%`;
        contrastSlider.nextElementSibling.textContent = `${contrast}%`;
        saturationSlider.nextElementSibling.textContent = `${saturation}%`;
        hueRotateSlider.nextElementSibling.textContent = `${hueRotate}deg`;

        canvas.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hueRotate}deg)`;

        // Note: This only *visually* changes the canvas element.
        // The actual pixel data on the canvas remains unchanged.
        // To make this permanent, you'd need to re-render the image
        // or current canvas state to an offscreen canvas with the
        // filter applied (tricky in pure JS) or implement these filters
        // via pixel manipulation algorithms (complex math).
        // For this demo, it's a live preview only.
        // A real app would have an "Apply" button that runs the pixel logic or uses a library.
    }

    // Reset CSS filters
    function resetCSSTransformations() {
        brightnessSlider.value = 100;
        contrastSlider.value = 100;
        saturationSlider.value = 100;
        hueRotateSlider.value = 0;
        applyCSSTransformations();
         // A real editor might also save state here if resetting is a history action
    }

    // --- Drawing ---
    function startDrawing(e) {
        if (currentTool !== 'draw' || isCropping) return; // Only draw if draw tool is active and not cropping
         // Check if the click originated directly on the canvas, not an overlay
         if (e.target !== canvas) return;

        isDrawing = true;
        const { x, y } = getMousePos(canvas, e);
        ctx.beginPath(); // Start a new path for drawing segments
        ctx.moveTo(x, y); // Move to the initial click point

        // Set drawing style based on selected tool/color/size
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;

        if (drawTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'; // Make pixels transparent
            ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter for destination-out, but setting it is harmless
        } else { // brush
            ctx.globalCompositeOperation = 'source-over'; // Draw normally
            ctx.strokeStyle = drawColor;
        }
    }

    function draw(e) {
        if (!isDrawing || isCropping || e.target !== canvas) return; // Only draw if isDrawing and mouse is over canvas
        const { x, y } = getMousePos(canvas, e);
        ctx.lineTo(x, y); // Add a line segment to the path
        ctx.stroke(); // Draw the current path

        // Optional: For very precise drawing, you might want to save smaller segments
        // or draw dots between points for slow mouse movements.
    }

    function stopDrawing() {
        if (!isDrawing) return; // Only stop if we were drawing
        isDrawing = false;
        ctx.closePath(); // End the path

        // Reset composite operation if it was changed for eraser
        if (drawTool === 'eraser') {
             ctx.globalCompositeOperation = 'source-over';
        }

        saveState(); // Save the state after drawing stops
    }

    // --- Text ---
    function showTextOverlay(x, y) {
        // Position the overlay visually where text will be placed
        textOverlay.style.left = `${x}px`;
        textOverlay.style.top = `${y}px`;
        textOverlay.style.color = textColorPicker.value;
        textOverlay.style.fontSize = `${fontSizeSlider.value}px`;
        textOverlay.style.fontFamily = fontFamilySelect.value;
        textOverlay.textContent = textInput.value || 'Your Text'; // Show input text or default
        textOverlay.classList.remove('hidden');
        activeOverlay = 'textOverlay';
    }

    function hideOverlay(overlayElement) {
        overlayElement.classList.add('hidden');
        if (activeOverlay === (overlayElement === textOverlay ? 'textOverlay' : 'stickerOverlay')) {
            activeOverlay = null;
        }
         isDraggingOverlay = false;
         overlayOffsetX = overlayOffsetY = 0;
    }

    function addTextToCanvas() {
        if (!currentImage || textInput.value.trim() === '') return;

        // Get the final position from the overlay
        const overlayRect = textOverlay.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width; // Calculate scaling factor
        const scaleY = canvas.height / canvasRect.height;

        const textX = (overlayRect.left - canvasRect.left) * scaleX;
        const textY = (overlayRect.top - canvasRect.top + overlayRect.height) * scaleY; // Position is baseline for fillText

        // Draw the text onto the canvas
        ctx.font = `${fontSizeSlider.value * scaleY}px ${fontFamilySelect.value}`; // Scale font size too
        ctx.fillStyle = textColorPicker.value;
        ctx.fillText(textInput.value, textX, textY);

        hideOverlay(textOverlay);
        saveState(); // Save state after adding text
        textInput.value = ''; // Clear input field
        // Reset overlay text to default if desired
         textOverlay.textContent = 'Your Text';
    }

    // --- Stickers ---
    function showStickerOverlay(stickerSrc, x, y) {
        stickerOverlayImg.src = stickerSrc;
        // Position the overlay visually
        stickerOverlay.style.left = `${x}px`;
        stickerOverlay.style.top = `${y}px`;
         // Set initial size (e.g., 100px) - resizing could be added
        stickerOverlay.style.width = '100px';
        stickerOverlay.style.height = '100px'; // Maintain aspect ratio or set fixed height
        stickerOverlay.classList.remove('hidden');
        activeOverlay = 'stickerOverlay';
    }

    function addStickerToCanvas(stickerSrc) {
         if (!currentImage) return;

        const img = new Image();
        img.onload = () => {
            // Get the final position and size from the overlay
            const overlayRect = stickerOverlay.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / canvasRect.width;
            const scaleY = canvas.height / canvasRect.height;

            const stickerX = (overlayRect.left - canvasRect.left) * scaleX;
            const stickerY = (overlayRect.top - canvasRect.top) * scaleY;
            const stickerWidth = overlayRect.width * scaleX;
            const stickerHeight = overlayRect.height * scaleY;

            // Draw the sticker onto the canvas
            ctx.drawImage(img, stickerX, stickerY, stickerWidth, stickerHeight);

            hideOverlay(stickerOverlay);
            saveState(); // Save state after adding sticker
        };
        img.src = stickerSrc;
    }


     // --- Overlay Dragging (Text/Sticker) ---
     function startOverlayDrag(e) {
        // Only start drag if the target is the overlay element itself (or its content for stickers)
        if (e.target !== textOverlay && e.target !== stickerOverlay && e.target !== stickerOverlayImg) return;
         // Prevent dragging canvas when overlay is active
         if (currentTool === 'draw' || isCropping) return;


        // Determine which overlay is active
        const overlay = e.target === textOverlay ? textOverlay : stickerOverlay;
         if (overlay.classList.contains('hidden')) return; // Don't drag hidden overlays

        isDraggingOverlay = true;
        activeOverlay = overlay === textOverlay ? 'textOverlay' : 'stickerOverlay';

        // Calculate offset relative to the element's top-left corner
        const rect = overlay.getBoundingClientRect();
        overlayOffsetX = e.clientX - rect.left;
        overlayOffsetY = e.clientY - rect.top;

        overlay.style.cursor = 'grabbing'; // Change cursor while dragging
     }

    function dragOverlay(e) {
        if (!isDraggingOverlay || !activeOverlay) return;

        const overlay = activeOverlay === 'textOverlay' ? textOverlay : stickerOverlay;

        // Calculate new position based on mouse position and initial offset
        let newLeft = e.clientX - overlayOffsetX;
        let newTop = e.clientY - overlayOffsetY;

        // Constrain dragging within the canvas wrapper boundaries (optional but good UX)
        const wrapperRect = canvasWrapper.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();

        newLeft = Math.max(wrapperRect.left, newLeft);
        newTop = Math.max(wrapperRect.top, newTop);
        newLeft = Math.min(wrapperRect.right - overlayRect.width, newLeft);
        newTop = Math.min(wrapperRect.bottom - overlayRect.height, newTop);


        // Position the overlay relative to the canvas wrapper (its offset parent)
        // Need wrapper's position to calculate relative offset
        const wrapperOffsetLeft = wrapperRect.left;
        const wrapperOffsetTop = wrapperRect.top;

        overlay.style.left = `${newLeft - wrapperOffsetLeft}px`;
        overlay.style.top = `${newTop - wrapperOffsetTop}px`;
    }

     function stopOverlayDrag() {
        if (!isDraggingOverlay) return;
        isDraggingOverlay = false;
        // Reset cursor
        if (activeOverlay === 'textOverlay') textOverlay.style.cursor = 'grab';
        if (activeOverlay === 'stickerOverlay') stickerOverlay.style.cursor = 'grab';

         // A real editor might save the position here and draw, or update an object state
         // For this simple version, the element is just visually moved until applied
     }

     // --- Crop ---
     function startCropping() {
        if (!currentImage) return;

        isCropping = true;
        currentTool = 'crop'; // Ensure crop tab is active if not already

        // Hide other overlays
        hideOverlay(textOverlay);
        hideOverlay(stickerOverlay);

        // Show crop overlay
        cropOverlay.classList.remove('hidden');
         // Initially, the crop area covers the whole canvas
        setCropRect(0, 0, canvas.width, canvas.height);

        // Disable start button, enable apply/cancel
        startCropBtn.disabled = true;
        applyCropBtn.disabled = false;
        cancelCropBtn.disabled = false;

         // Add crop-specific mouse listeners to the OVERLAY
         cropOverlay.addEventListener('mousedown', handleCropMouseDown);
         document.addEventListener('mousemove', handleCropMouseMove); // Listen on document for dragging outside overlay
         document.addEventListener('mouseup', handleCropMouseUp);
     }

     function setCropRect(x, y, width, height) {
         // Ensure coordinates are within canvas bounds
         x = Math.max(0, x);
         y = Math.max(0, y);
         width = Math.max(0, Math.min(width, canvas.width - x));
         height = Math.max(0, Math.min(height, canvas.height - y));

        cropRect = { x, y, width, height };

        // Update CSS variables for the pseudo-element
        const canvasRect = canvas.getBoundingClientRect();
         // Calculate percentage relative to canvas *display* size
         const displayScaleX = canvas.width / canvasRect.width;
         const displayScaleY = canvas.height / canvasRect.height;

         // Translate canvas pixel coordinates to percentage/pixels relative to overlay
        cropOverlay.style.setProperty('--crop-x', `${x / displayScaleX}px`);
        cropOverlay.style.setProperty('--crop-y', `${y / displayScaleY}px`);
        cropOverlay.style.setProperty('--crop-width', `${width / displayScaleX}px`);
        cropOverlay.style.setProperty('--crop-height', `${height / displayScaleY}px`);

         // Position crop handles (simplified - corners only)
         const handles = cropOverlay.querySelectorAll('.crop-corner');
         handles.forEach(handle => {
             if (handle.classList.contains('top-left')) { handle.style.left = `${x / displayScaleX}px`; handle.style.top = `${y / displayScaleY}px`; }
             if (handle.classList.contains('top-right')) { handle.style.left = `${(x + width) / displayScaleX}px`; handle.style.top = `${y / displayScaleY}px`; }
             if (handle.classList.contains('bottom-left')) { handle.style.left = `${x / displayScaleX}px`; handle.style.top = `${(y + height) / displayScaleY}px`; }
             if (handle.classList.contains('bottom-right')) { handle.style.left = `${(x + width) / displayScaleX}px`; handle.style.top = `${(y + height) / displayScaleY}px`; }
         });
         // Position side handles (simplified)
         const sides = cropOverlay.querySelectorAll('.crop-side');
         sides.forEach(side => {
            if (side.classList.contains('top')) { side.style.left = `${(x + 5) / displayScaleX}px`; side.style.top = `${y / displayScaleY}px`; side.style.width = `${(width - 10) / displayScaleX}px`; side.style.height = '10px'; }
            if (side.classList.contains('bottom')) { side.style.left = `${(x + 5) / displayScaleX}px`; side.style.top = `${(y + height) / displayScaleY}px`; side.style.width = `${(width - 10) / displayScaleX}px`; side.style.height = '10px'; }
            if (side.classList.contains('left')) { side.style.left = `${x / displayScaleX}px`; side.style.top = `${(y + 5) / displayScaleY}px`; side.style.width = '10px'; side.style.height = `${(height - 10) / displayScaleY}px`; }
            if (side.classList.contains('right')) { side.style.left = `${(x + width) / displayScaleX}px`; side.style.top = `${(y + 5) / displayScaleY}px`; side.style.width = '10px'; side.style.height = `${(height - 10) / displayScaleY}px`; }
         });
     }

     function handleCropMouseDown(e) {
        e.preventDefault(); // Prevent default browser drag behaviors

        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;

        const mouseX = (e.clientX - canvasRect.left) * scaleX;
        const mouseY = (e.clientY - canvasRect.top) * scaleY;

         // Check if clicking a handle
        if (e.target.classList.contains('crop-corner') || e.target.classList.contains('crop-side')) {
             isResizingCrop = true;
             activeCropHandle = e.target.classList[1]; // e.g., 'top-left', 'top', 'left'
        } else {
             // Assume clicking inside the current crop area to move it
             // Check if mouse is within the current cropRect bounds (approximately, as overlay might be scaled)
             const overlayRect = cropOverlay.querySelector('::before') ? cropOverlay.getBoundingClientRect() : canvasRect; // Use overlay bounds if rendered
              // Simple check: just assume clicking the overlay starts a move
             isDraggingOverlay = true; // Use the same drag state as text/sticker
             activeOverlay = 'cropOverlay'; // Use this to identify in dragOverlay
             overlayOffsetX = mouseX - cropRect.x;
             overlayOffsetY = mouseY - cropRect.y;
        }

        startCropX = mouseX; // Store start position for both dragging and resizing
        startCropY = mouseY;
     }

     function handleCropMouseMove(e) {
        if (!isCropping) return; // Only handle if cropping is active

        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        const mouseX = (e.clientX - canvasRect.left) * scaleX;
        const mouseY = (e.clientY - canvasRect.top) * scaleY;

         // Constrain mouse position to canvas bounds for calculations
        const clampedMouseX = Math.max(0, Math.min(mouseX, canvas.width));
        const clampedMouseY = Math.max(0, Math.min(mouseY, canvas.height));

        if (isResizingCrop) {
             // Calculate new cropRect based on handle and mouse movement
             let { x, y, width, height } = cropRect;
             const dx = clampedMouseX - startCropX;
             const dy = clampedMouseY - startCropY;

             // Store original values to check against minimum size
             const originalX = x;
             const originalY = y;
             const originalWidth = width;
             const originalHeight = height;

             // Minimum crop size
             const minSize = 20; // pixels

             switch (activeCropHandle) {
                 case 'top-left':
                     x += dx; y += dy; width -= dx; height -= dy;
                      if (width < minSize) { width = minSize; x = originalX + originalWidth - minSize; }
                      if (height < minSize) { height = minSize; y = originalY + originalHeight - minSize; }
                     break;
                 case 'top-right':
                     y += dy; width += dx; height -= dy;
                      if (width < minSize) width = minSize;
                      if (height < minSize) { height = minSize; y = originalY + originalHeight - minSize; }
                     break;
                 case 'bottom-left':
                     x += dx; width -= dx; height += dy;
                      if (width < minSize) { width = minSize; x = originalX + originalWidth - minSize; }
                      if (height < minSize) height = minSize;
                     break;
                 case 'bottom-right':
                     width += dx; height += dy;
                      if (width < minSize) width = minSize;
                      if (height < minSize) height = minSize;
                     break;
                 case 'top':
                     y += dy; height -= dy;
                      if (height < minSize) { height = minSize; y = originalY + originalHeight - minSize; }
                     break;
                 case 'bottom':
                     height += dy;
                      if (height < minSize) height = minSize;
                     break;
                 case 'left':
                     x += dx; width -= dx;
                     if (width < minSize) { width = minSize; x = originalX + originalWidth - minSize; }
                     break;
                 case 'right':
                     width += dx;
                      if (width < minSize) width = minSize;
                     break;
             }

             // Update start point for the next mouse move event
             startCropX = clampedMouseX;
             startCropY = clampedMouseY;

             setCropRect(x, y, width, height);

        } else if (isDraggingOverlay && activeOverlay === 'cropOverlay') {
             // Calculate new position based on mouse position and initial offset
             let newX = clampedMouseX - overlayOffsetX;
             let newY = clampedMouseY - overlayOffsetY;

             // Ensure the whole rectangle stays within canvas bounds
             newX = Math.max(0, Math.min(newX, canvas.width - cropRect.width));
             newY = Math.max(0, Math.min(newY, canvas.height - cropRect.height));

             setCropRect(newX, newY, cropRect.width, cropRect.height);
        } else {
             // Drawing a new crop rectangle
             // This logic would go here if you wanted to allow click+drag to define the *initial* rectangle
             // For now, we start with full canvas and allow drag/resize.
        }
     }

     function handleCropMouseUp() {
        if (!isCropping) return;

         isResizingCrop = false;
         isDraggingOverlay = false; // For moving the crop rectangle
         activeCropHandle = null;
         activeOverlay = null; // Reset active overlay state

         // No state save on mouseup, only on apply
     }


     function applyCrop() {
         if (!currentImage || !isCropping) return;

         // Get the cropped area pixel data
         const croppedImageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.width, cropRect.height);

         // Resize the canvas to the new cropped dimensions
         canvas.width = cropRect.width;
         canvas.height = cropRect.height;

         // Clear the canvas (resize already did this)
         // ctx.clearRect(0, 0, canvas.width, canvas.height); // Not needed after resize

         // Draw the cropped image data onto the new smaller canvas
         ctx.putImageData(croppedImageData, 0, 0);

         // Update original/current image references or just rely on canvas state
         // For simplicity, rely on canvas state and save it.
          currentImage = null; // The current state is now on the canvas pixels


         // Hide crop overlay and reset state
         hideOverlay(cropOverlay);
         isCropping = false;
         startCropBtn.disabled = false;
         applyCropBtn.disabled = true;
         cancelCropBtn.disabled = true;

         // Remove crop-specific mouse listeners
         cropOverlay.removeEventListener('mousedown', handleCropMouseDown);
         document.removeEventListener('mousemove', handleCropMouseMove);
         document.removeEventListener('mouseup', handleCropMouseUp);


         saveState(); // Save the state after applying crop
     }

     function cancelCrop() {
         if (!isCropping) return;

         // Hide crop overlay and reset state without applying changes
         hideOverlay(cropOverlay);
         isCropping = false;
         startCropBtn.disabled = false;
         applyCropBtn.disabled = true;
         cancelCropBtn.disabled = true;

         // Remove crop-specific mouse listeners
         cropOverlay.removeEventListener('mousedown', handleCropMouseDown);
         document.removeEventListener('mousemove', handleCropMouseMove);
         document.removeEventListener('mouseup', handleCropMouseUp);

         // No state change, so no saveState() call needed
     }


    // --- Download ---
    function downloadImage(format = 'png') {
        if (!currentImage) return;

        // Create a temporary link element
        const link = document.createElement('a');
        link.download = `edited_image.${format}`; // Set the filename

         // If CSS filters were applied for adjustment preview,
         // we would need to render the canvas with those filters applied first!
         // This requires drawing to a temporary canvas with filters enabled or
         // implementing the filters via pixel manipulation here before download.
         // For this demo, the download will NOT include the CSS filter preview effects.
         // Only pixel filters (grayscale, sepia, invert) and drawing/text/stickers/crop are permanent.

        let mimeType;
        let quality; // For JPEG

        if (format === 'jpeg' || format === 'jpg') {
            mimeType = 'image/jpeg';
            quality = 0.9; // You can adjust JPEG quality (0 to 1)
        } else {
            mimeType = 'image/png';
        }

        // Get the image data as a Data URL
        link.href = canvas.toDataURL(mimeType, quality);

        // Programmatically click the link to trigger the download
        link.click();
    }

    // --- Session Saving (Basic) ---
    function saveSession() {
        if (!currentImage) {
            console.log("No image to save session.");
            return;
        }
        try {
            // Save current canvas state (DataURL) and history
            localStorage.setItem('editorCanvasState', canvas.toDataURL());
            localStorage.setItem('editorHistory', JSON.stringify(history));
            localStorage.setItem('editorHistoryIndex', historyIndex);
            console.log("Session saved to localStorage.");
        } catch (e) {
            console.error("Failed to save session to localStorage:", e);
             alert("Could not save session. Local storage might be full or disabled.");
        }
    }

    function loadSession() {
        try {
            const savedState = localStorage.getItem('editorCanvasState');
            const savedHistory = localStorage.getItem('editorHistory');
            const savedHistoryIndex = localStorage.getItem('editorHistoryIndex');

            if (savedState) {
                 // Load the canvas state
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    currentImage = img; // Update current image reference

                    placeholder.style.display = 'none';
                    canvas.style.display = 'block';

                    // Load history if available
                    if (savedHistory) {
                         history = JSON.parse(savedHistory);
                         historyIndex = parseInt(savedHistoryIndex, 10);
                         updateHistoryButtons();
                         console.log("Session loaded from localStorage with history.");
                    } else {
                         // If no history saved, just save the loaded state as the first history item
                         history = [];
                         historyIndex = -1;
                         saveState();
                         console.log("Session loaded from localStorage (no history found).");
                    }

                     // Apply saved CSS adjustments visually if they were also saved (more complex)
                     // For this basic version, adjustments are not saved permanently.
                      resetCSSTransformations(); // Reset adjustments on load
                     applyCSSTransformations(); // Re-apply based on slider values (which are not loaded here)

                    // Hide overlays
                     hideOverlay(textOverlay);
                     hideOverlay(stickerOverlay);
                     hideOverlay(cropOverlay);
                      isCropping = false;
                     startCropBtn.disabled = false;
                     applyCropBtn.disabled = true;
                     cancelCropBtn.disabled = true;
                     // Remove crop listeners if they were active
                     cropOverlay.removeEventListener('mousedown', handleCropMouseDown);
                     document.removeEventListener('mousemove', handleCropMouseMove);
                     document.removeEventListener('mouseup', handleCropMouseUp);


                };
                img.src = savedState;
            } else {
                console.log("No saved session found in localStorage.");
                 alert("No saved editor session found.");
            }
        } catch (e) {
            console.error("Failed to load session from localStorage:", e);
             alert("Could not load session. Data might be corrupted or storage disabled.");
        }
    }


    // --- Dark Mode ---
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('darkMode');
        if (savedTheme === 'enabled') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // --- Helper Functions ---
    function getMousePos(canvasElement, event) {
        const rect = canvasElement.getBoundingClientRect(); // Get canvas position and size relative to viewport
        const scaleX = canvasElement.width / rect.width;       // Calculate scaling factor
        const scaleY = canvasElement.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX, // Scale mouse coordinates to canvas coordinates
            y: (event.clientY - rect.top) * scaleY
        };
    }

    function getOverlayPos(overlayElement, event) {
         const rect = overlayElement.getBoundingClientRect();
         return {
             x: event.clientX - rect.left,
             y: event.clientY - rect.top
         };
    }


    // --- Event Listeners ---

    // File Upload
    imageUpload.addEventListener('change', (event) => {
        if (event.target.files && event.target.files[0]) {
            loadImage(event.target.files[0]);
        }
    });

    // Filter Buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentImage && !isCropping) { // Only apply filter if image loaded and not cropping
                const filterName = button.dataset.filter;
                 // Ensure no CSS filters are interfering before applying pixel filter
                 canvas.style.filter = 'none';
                 resetCSSTransformations(); // Reset CSS sliders visually too
                applyPixelFilter(filterName);
            }
        });
    });

     // Adjust Sliders (CSS Filters)
     adjustSliders.forEach(slider => {
        slider.addEventListener('input', applyCSSTransformations);
     });
    resetAdjustmentsBtn.addEventListener('click', resetCSSTransformations);


    // Draw Controls
    drawColorPicker.addEventListener('input', (e) => drawColor = e.target.value);
    brushSizeSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value, 10);
        brushSizeValueSpan.textContent = brushSize;
    });
    drawToolSelect.addEventListener('change', (e) => drawTool = e.target.value);


    // Drawing Event Listeners - These are ADDED/REMOVED when switching to/from draw tab
    // canvas.addEventListener('mousedown', startDrawing); // Added when draw tab active
    // canvas.addEventListener('mousemove', draw);       // Added when draw tab active
    // canvas.addEventListener('mouseup', stopDrawing);         // Added when draw tab active
    // canvas.addEventListener('mouseout', stopDrawing); // Added when draw tab active


    // Text Controls
    textColorPicker.addEventListener('input', (e) => {
         textColor = e.target.value;
         if (activeOverlay === 'textOverlay') textOverlay.style.color = textColor;
    });
    fontSizeSlider.addEventListener('input', (e) => {
        fontSize = parseInt(e.target.value, 10);
        fontSizeValueSpan.textContent = `${fontSize}px`;
         if (activeOverlay === 'textOverlay') textOverlay.style.fontSize = `${fontSize}px`;
    });
    fontFamilySelect.addEventListener('change', (e) => {
         fontFamily = e.target.value;
         if (activeOverlay === 'textOverlay') textOverlay.style.fontFamily = fontFamily;
    });

     // Add text button click
     addTextBtn.addEventListener('click', () => {
         if (!currentImage || isCropping) return;

         // Get the center of the canvas wrapper as a starting point for the overlay
         const wrapperRect = canvasWrapper.getBoundingClientRect();
         const startX = wrapperRect.width / 2 - textOverlay.offsetWidth / 2; // Center horizontally
         const startY = wrapperRect.height / 2 - textOverlay.offsetHeight / 2; // Center vertically

         showTextOverlay(startX, startY);
         activeOverlay = 'textOverlay'; // Mark text overlay as active for dragging

         // Add event listener to apply text when Enter is pressed in the input field
         textInput.addEventListener('keypress', function(e) {
             if (e.key === 'Enter') {
                 e.preventDefault(); // Prevent default form submission if applicable
                 addTextToCanvas();
                  // Remove the specific listener after applying
                 textInput.removeEventListener('keypress', arguments.callee); // Removes this specific instance
             }
         });
     });


    // Stickers
    stickerOptions.forEach(sticker => {
        sticker.addEventListener('click', (e) => {
             if (!currentImage || isCropping) return;

             const stickerSrc = e.target.src;
             // Get the center of the canvas wrapper as a starting point for the overlay
             const wrapperRect = canvasWrapper.getBoundingClientRect();
             // Assume overlay will be approx 100x100 for centering
             const startX = wrapperRect.width / 2 - 50;
             const startY = wrapperRect.height / 2 - 50;

             showStickerOverlay(stickerSrc, startX, startY);
             activeOverlay = 'stickerOverlay'; // Mark sticker overlay as active for dragging
        });
    });

    // Overlay Dragging Event Listeners (Text/Sticker/Crop Overlay Move)
     // Listen on canvas wrapper because overlays are positioned within it
     canvasWrapper.addEventListener('mousedown', startOverlayDrag); // Covers text/sticker overlay drag start
     canvasWrapper.addEventListener('mousemove', dragOverlay);
     canvasWrapper.addEventListener('mouseup', stopOverlayDrag);
     canvasWrapper.addEventListener('mouseout', stopOverlayDrag); // Stop drag if mouse leaves wrapper

    // Important: Dragging *from* the overlay should also update position.
    // Let's add mousedown/mouseup to the overlays directly for starting drag
    textOverlay.addEventListener('mousedown', startOverlayDrag);
    stickerOverlay.addEventListener('mousedown', startOverlayDrag);
     // Crop overlay mousedown is handled separately by handleCropMouseDown

     // Need a way to CONFIRM text/sticker placement (e.g., double click overlay, or a button)
     // Simple approach: Double-click the overlay to apply to canvas
     textOverlay.addEventListener('dblclick', addTextToCanvas);
     stickerOverlay.addEventListener('dblclick', () => {
         addStickerToCanvas(stickerOverlayImg.src);
     });


    // Crop Controls Listeners
    startCropBtn.addEventListener('click', startCropping);
    applyCropBtn.addEventListener('click', applyCrop);
    cancelCropBtn.addEventListener('click', cancelCrop);

    // Crop Overlay Listeners are added/removed in startCropping/applyCrop/cancelCrop

    // History Buttons
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (event) => {
        // Check for Ctrl (Windows/Linux) or Cmd (macOS) + Z/Y
        const isCtrlCmd = event.ctrlKey || event.metaKey;
        if (isCtrlCmd) {
            if (event.key === 'z') {
                event.preventDefault(); // Prevent browser undo
                undo();
            } else if (event.key === 'y') {
                event.preventDefault(); // Prevent browser redo
                redo();
            }
        }
         // Escape key to cancel crop or active overlay drag? (Optional refinement)
         if (event.key === 'Escape') {
             if (isCropping) {
                 cancelCrop();
             }
              // Also hide active text/sticker overlay if escape is pressed?
              if (activeOverlay === 'textOverlay' && !textOverlay.classList.contains('hidden')) {
                 hideOverlay(textOverlay);
              }
              if (activeOverlay === 'stickerOverlay' && !stickerOverlay.classList.contains('hidden')) {
                 hideOverlay(stickerOverlay);
              }
         }
    });


    // Download Button
    downloadPngBtn.addEventListener('click', () => downloadImage('png'));
    // Add a JPEG button if needed, e.g., downloadJpegBtn.addEventListener('click', () => downloadImage('jpeg'));


    // Dark Mode Toggle
    darkModeToggle.addEventListener('click', toggleDarkMode);

    // Session Save/Load
    saveSessionBtn.addEventListener('click', saveSession);
    loadSessionBtn.addEventListener('click', loadSession);


    // --- Initialization ---
    applySavedTheme(); // Apply dark/light mode on load
    // Optional: Load last session on startup
    // loadSession(); // Decide if you want this auto or manual


    // Initial state
    canvas.style.display = 'none'; // Hide canvas until image is loaded
    placeholder.style.display = 'block'; // Show placeholder initially
    updateHistoryButtons(); // Disable undo/redo buttons initially

     // Sync initial slider values to spans
     brushSizeValueSpan.textContent = brushSizeSlider.value;
     fontSizeValueSpan.textContent = `${fontSizeSlider.value}px`;
     applyCSSTransformations(); // Set initial CSS filter values on load

    console.log("Editor initialized.");

}); // End DOMContentLoaded
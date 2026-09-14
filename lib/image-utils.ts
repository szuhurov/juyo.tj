/**
 * For reducing image file size before upload.
 * This is needed to make the site work faster.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1000,
  quality: number = 0.75
): Promise<File> {

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Reading the file and converting it to DataURL format
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        // Creating a Canvas element for graphics processing in the browser
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculating the aspect ratio to preserve quality
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // If the Canvas context isn't available, send the original file
        }

        // Drawing the image onto the Canvas at the new dimensions
        ctx.drawImage(img, 0, 0, width, height);

        // Converting the Canvas content to a Blob (Binary Large Object) in JPEG format
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Creating a new compressed file from the Blob object
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}

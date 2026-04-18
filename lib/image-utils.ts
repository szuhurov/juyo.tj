/**
 * Барои паст кардани вазни суратҳо пеш аз боргузорӣ.
 * Ин кор барои тезтар кор кардани сайт лозим аст.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<File> {
  // Агар ҳаҷми файл аз 200KB хурд бошад, онро фишурда намекунем
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Хондани файл ва табдил додани он ба формати DataURL
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        // Сохтани элементи Canvas барои коркарди графикӣ дар браузер
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Ҳисобкунии таносуби андозаҳо (Aspect Ratio) барои нигоҳ доштани сифат
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // Агар контексти Canvas дастрас набошад, файли аслиро мефиристем
        }

        // Кашидани акс дар Canvas бо андозаҳои нав
        ctx.drawImage(img, 0, 0, width, height);
        
        // Табдил додани мазмуни Canvas ба BloB (Binary Large Object) бо формати JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Сохтани файли нави фишурдашуда аз объект Blob
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

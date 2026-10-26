// Helpers shared by the dashboard and the invoice screens.
export const money = (n = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
export const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
export const optimizeProductImage = (file, maxSize = 720) => new Promise((resolve, reject) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('Choose a JPG, PNG, or WebP image.'));
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Choose an image smaller than 5 MB.'));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read this image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not open this image.'));
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Image processing is unavailable in this browser.'));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const webp = canvas.toDataURL('image/webp', 0.82);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
export const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, { cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not complete the request.');
  return data;
};

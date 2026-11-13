// What a framed client site may do. No allow-same-origin: the page gets an origin of its own,
// so its scripts can never read or act on the portal. Used as the iframe's sandbox attribute
// and as the Content-Security-Policy on everything the frame serves.
export const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to load profile photos from Google's CDN.
    // Without this, <Image src="https://lh3.googleusercontent.com/..." /> throws an error.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",  // Google profile photos
      },
      {
        protocol: "https",
        hostname: "media.rawg.io",              // RAWG game cover art
      },
    ],
  },
};

export default nextConfig;

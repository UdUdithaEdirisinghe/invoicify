import { put } from '@vercel/blob';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authResult = verifyToken(req);
    if (!authResult.success) {
        return res.status(401).json({ error: authResult.error });
    }

    try {
        const filename = req.headers['x-filename'] || `invoice-${Date.now()}.pdf`;
        
        // Upload to Vercel Blob
        // Note: req is a readable stream, which put() accepts
        const blob = await put(filename, req, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Upload failed:', error);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
}

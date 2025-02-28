// SERVER SETUP
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Prisma Client
const prisma = new PrismaClient();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// AUTHENTICATION MIDDLEWARE
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token' });
    }
};

// AUTH ROUTES
// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword
            }
        });

        // Create token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Validate password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Create token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// NOTE ROUTES
// Get all notes for a user
app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const notes = await prisma.note.findMany({
            where: {
                userId: req.user.id
            },
            orderBy: {
                updatedAt: 'desc'
            },
            include: {
                images: true
            }
        });

        res.status(200).json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get a specific note
app.get('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const note = await prisma.note.findFirst({
            where: {
                id: parseInt(req.params.id),
                userId: req.user.id
            },
            include: {
                images: true
            }
        });

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        res.status(200).json(note);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a note
app.post('/api/notes', authenticateToken, async (req, res) => {
    try {
        const { title, content, category } = req.body;

        const note = await prisma.note.create({
            data: {
                title,
                content,
                category: category || 'General',
                userId: req.user.id
            }
        });

        res.status(201).json(note);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a note
app.put('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const { title, content, category } = req.body;
        const noteId = parseInt(req.params.id);

        // Check if note exists and belongs to user
        const existingNote = await prisma.note.findFirst({
            where: {
                id: noteId,
                userId: req.user.id
            }
        });

        if (!existingNote) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Update note
        const updatedNote = await prisma.note.update({
            where: {
                id: noteId
            },
            data: {
                title: title || existingNote.title,
                content: content || existingNote.content,
                category: category || existingNote.category,
            },
            include: {
                images: true
            }
        });

        res.status(200).json(updatedNote);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a note
app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);

        // Find the note to get associated images
        const note = await prisma.note.findFirst({
            where: {
                id: noteId,
                userId: req.user.id
            },
            include: {
                images: true
            }
        });

        if (!note) {
            return res.status(404).json({ message: 'Note not found or unauthorized' });
        }

        // Delete note (this will cascade delete images in the database thanks to Prisma relations)
        await prisma.note.delete({
            where: {
                id: noteId
            }
        });

        // Delete image files from filesystem
        for (const image of note.images) {
            const imagePath = path.join(__dirname, image.path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.status(200).json({ message: 'Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// IMAGE ROUTES
// Upload image to a note
app.post('/api/notes/:id/images', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);

        // Check if note exists and belongs to user
        const note = await prisma.note.findFirst({
            where: {
                id: noteId,
                userId: req.user.id
            }
        });

        if (!note) {
            // Remove uploaded file if note doesn't exist
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ message: 'Note not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        // Save image record to database
        const image = await prisma.image.create({
            data: {
                filename: req.file.filename,
                path: 'uploads/' + req.file.filename,
                mimetype: req.file.mimetype,
                size: req.file.size,
                noteId: noteId
            }
        });

        res.status(201).json({
            message: 'Image uploaded successfully',
            image: {
                id: image.id,
                filename: image.filename,
                path: image.path,
                url: `${req.protocol}://${req.get('host')}/${image.path}`
            }
        });
    } catch (err) {
        // Remove uploaded file if an error occurs
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: err.message });
    }
});

// Delete an image
app.delete('/api/images/:id', authenticateToken, async (req, res) => {
    try {
        const imageId = parseInt(req.params.id);

        // Check if image exists and belongs to user's note
        const image = await prisma.image.findFirst({
            where: {
                id: imageId,
                note: {
                    userId: req.user.id
                }
            }
        });

        if (!image) {
            return res.status(404).json({ message: 'Image not found or unauthorized' });
        }

        // Delete image from database
        await prisma.image.delete({
            where: {
                id: imageId
            }
        });

        // Delete image file from filesystem
        const imagePath = path.join(__dirname, image.path);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        res.status(200).json({ message: 'Image deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// SERVER START
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
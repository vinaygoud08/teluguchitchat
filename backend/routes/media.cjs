const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit to allow larger videos
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ msg: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(500).json({ msg: err.message });
  }
  next();
};

const supabase = require('../supabaseClient.cjs');

const verifyToken = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_for_chitchat');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

router.post('/upload', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }
  
  try {
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('abcd')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('abcd')
      .getPublicUrl(fileName);

    res.json({ imageUrl: publicUrlData.publicUrl });
  } catch (err) {
    console.error('Supabase Upload Error:', err);
    res.status(500).json({ msg: 'Error uploading to Supabase storage' });
  }
});

router.post('/upload-profile-media', verifyToken, (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }
  
  const { type } = req.body; // 'status' or 'song'
  if (!type || (type !== 'status' && type !== 'song')) {
    return res.status(400).json({ msg: 'Invalid media type' });
  }

  try {
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const fileName = `profile_${type}_${Date.now()}_${safeName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('abcd')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('abcd')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;
    const updateField = type === 'status' ? 'statusVideoUrl' : 'profileSongUrl';
    const updateData = {};
    updateData[updateField] = fileUrl;
    
    if (type === 'status') {
      updateData['story_views'] = []; // Clear viewers for new story
    }
    
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id);

    if (error) throw error;

    if (type === 'status') {
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .match({ room: 'story_view', recipientId: req.user.id });
      if (deleteError) console.error('Error clearing old story views:', deleteError);
    }

    res.json({ msg: 'Profile updated successfully', url: fileUrl });
  } catch (err) {
    console.error('Supabase Upload Error:', err);
    res.status(500).send('Server error');
  }
});

router.post('/upload-avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }

  try {
    const fileName = `profile_photo_${req.user.id}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('abcd')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true // Overwrite existing avatar
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('abcd')
      .getPublicUrl(fileName);

    const fileUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`; // Add timestamp to break cache
    res.json({ msg: 'Avatar updated successfully', url: fileUrl });
  } catch (err) {
    console.error('Supabase Upload Error:', err);
    res.status(500).send('Server error');
  }
});

router.delete('/story', verifyToken, async (req, res) => {
  try {
    const { data: userProfile, error: fetchError } = await supabase
      .from('users')
      .select('statusVideoUrl')
      .eq('id', req.user.id)
      .single();

    if (fetchError) throw fetchError;

    if (userProfile && userProfile.statusVideoUrl) {
      try {
        const url = userProfile.statusVideoUrl;
        const parts = url.split('/abcd/');
        if (parts.length > 1) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from('abcd').remove([filePath]);
        }
      } catch (storageErr) {
        console.error('Error removing story file from storage:', storageErr);
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ statusVideoUrl: null, story_views: [] })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    await supabase
      .from('messages')
      .delete()
      .match({ room: 'story_view', recipientId: req.user.id });

    res.json({ msg: 'Story deleted successfully' });
  } catch (err) {
    console.error('Delete Story Error:', err);
    res.status(500).json({ msg: 'Failed to delete story' });
  }
});

module.exports = router;

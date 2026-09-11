const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient.cjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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

// Helper to check user role in a group
const getMemberRole = async (groupId, userId) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return data.role;
  } catch (err) {
    return null;
  }
};

// Create a new group (WhatsApp style)
router.post('/create', verifyToken, async (req, res) => {
  const { name, description, avatar_url, memberIds, edit_info_permission, send_messages_permission } = req.body;
  
  if (!name || !name.trim()) return res.status(400).json({ msg: 'Group name is required' });

  try {
    const groupData = {
      name: name.trim(),
      description: (description || '').trim(),
      avatar_url: avatar_url || null,
      created_by: req.user.id
    };

    // 1. Create the group
    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert([groupData])
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Add creator as admin
    const membersToInsert = [
      { group_id: newGroup.id, user_id: req.user.id, role: 'admin' }
    ];

    if (memberIds && Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id && id !== req.user.id) {
          membersToInsert.push({ group_id: newGroup.id, user_id: id, role: 'member' });
        }
      });
    }

    const { error: membersError } = await supabase
      .from('group_members')
      .insert(membersToInsert);

    if (membersError) throw membersError;

    // 3. Insert system announcement message
    await supabase.from('messages').insert([{
      room: newGroup.id,
      sender: 'System',
      senderId: req.user.id,
      text: `📢 ${req.user.username} created group "${name.trim()}".`
    }]).catch(err => console.error('Error adding system message:', err));

    // 4. Notify other members via socket
    const io = req.app.get('io');
    if (io) {
      if (memberIds && Array.isArray(memberIds)) {
        memberIds.forEach(id => {
          if (id !== req.user.id) {
            io.to(id).emit('added_to_group', newGroup);
          }
        });
      }
    }

    res.json({
      ...newGroup,
      myRole: 'admin',
      memberCount: membersToInsert.length
    });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ msg: 'Server Error creating group' });
  }
});

// Upload group avatar / icon
router.post('/upload-avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: 'No image file uploaded' });

  try {
    const fileName = `group_avatar_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('abcd')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('abcd')
      .getPublicUrl(fileName);

    res.json({ avatarUrl: publicUrlData.publicUrl });
  } catch (err) {
    console.error('Error uploading group avatar:', err);
    res.status(500).json({ msg: 'Failed to upload group icon' });
  }
});

// Get user's groups
router.get('/my-groups', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        role,
        groups (
          id, name, description, avatar_url, created_at, created_by
        )
      `)
      .eq('user_id', req.user.id);

    if (error) throw error;

    const groups = (data || []).filter(gm => gm.groups).map(gm => ({
      ...gm.groups,
      myRole: gm.role
    }));

    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ msg: 'Server Error fetching groups' });
  }
});

// Get full group details including creator and all members
router.get('/:id/details', verifyToken, async (req, res) => {
  try {
    const groupId = req.params.id;

    // 1. Get group info
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) return res.status(404).json({ msg: 'Group not found' });

    // 2. Get members
    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select(`
        user_id, role, joined_at,
        users ( id, username, email, profileSongUrl, statusVideoUrl )
      `)
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    const members = (membersData || []).map(m => ({
      ...(m.users || { id: m.user_id, username: 'User' }),
      role: m.role,
      joined_at: m.joined_at
    }));

    // Find creator username
    const creatorMember = members.find(m => m.id === group.created_by);
    const creatorName = creatorMember ? creatorMember.username : 'Admin';

    // Requester role
    const myMember = members.find(m => m.id === req.user.id);

    res.json({
      ...group,
      creatorName,
      myRole: myMember ? myMember.role : null,
      members
    });
  } catch (err) {
    console.error('Error fetching group details:', err);
    res.status(500).json({ msg: 'Server Error fetching group details' });
  }
});

// Get group members
router.get('/:id/members', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        user_id, role, joined_at,
        users ( id, username, email, profileSongUrl, statusVideoUrl )
      `)
      .eq('group_id', req.params.id);

    if (error) throw error;
    
    res.json((data || []).map(m => ({
      ...(m.users || { id: m.user_id, username: 'User' }),
      role: m.role,
      joined_at: m.joined_at
    })));
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Update group info & settings (WhatsApp style)
router.put('/:id', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const { name, description, avatar_url, edit_info_permission, send_messages_permission } = req.body;

  try {
    const role = await getMemberRole(groupId, req.user.id);
    if (!role) return res.status(403).json({ msg: 'You are not a member of this group' });

    // Fetch existing group to check permissions
    const { data: existingGroup, error: fetchErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (fetchErr || !existingGroup) return res.status(404).json({ msg: 'Group not found' });

    // If changing settings, must be admin
    if ((edit_info_permission !== undefined || send_messages_permission !== undefined) && role !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can change group settings' });
    }

    const updates = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: updatedGroup, error: updateError } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Broadcast system message
    let actionText = '';
    if (name && name.trim() !== existingGroup.name) {
      actionText = `✏️ ${req.user.username} changed the group subject to "${name.trim()}".`;
    } else if (description !== undefined && description !== existingGroup.description) {
      actionText = `📝 ${req.user.username} updated the group description.`;
    } else if (avatar_url && avatar_url !== existingGroup.avatar_url) {
      actionText = `🖼️ ${req.user.username} changed the group icon.`;
    }

    if (actionText) {
      await supabase.from('messages').insert([{
        room: groupId,
        sender: 'System',
        senderId: req.user.id,
        text: actionText
      }]).catch(() => {});
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('group_updated', updatedGroup);
      if (actionText) {
        io.to(groupId).emit('receive_group_message', {
          room: groupId,
          sender: 'System',
          senderId: req.user.id,
          text: actionText,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json(updatedGroup);
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ msg: 'Server Error updating group' });
  }
});

// Add members to existing group
router.post('/:id/members', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const { memberIds } = req.body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ msg: 'No participants selected' });
  }

  try {
    // Check if requester is creator or admin/member
    const { data: groupData } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', groupId)
      .single();

    const isCreator = groupData && groupData.created_by === req.user.id;
    const role = await getMemberRole(groupId, req.user.id);
    if (!isCreator && !role) return res.status(403).json({ msg: 'You are not a member or creator of this group' });

    // Insert new members
    const membersToInsert = memberIds.map(id => ({
      group_id: groupId,
      user_id: id,
      role: 'member'
    }));

    const { error: insertError } = await supabase
      .from('group_members')
      .upsert(membersToInsert, { onConflict: 'group_id,user_id' });

    if (insertError) throw insertError;

    // Fetch added users' usernames for system message
    const { data: addedUsers } = await supabase
      .from('users')
      .select('id, username')
      .in('id', memberIds);

    const names = (addedUsers || []).map(u => u.username).join(', ') || 'new participants';
    const actionText = `👤 ${req.user.username} added ${names}.`;

    await supabase.from('messages').insert([{
      room: groupId,
      sender: 'System',
      senderId: req.user.id,
      text: actionText
    }]).catch(() => {});

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      memberIds.forEach(id => {
        io.to(id).emit('added_to_group', { id: groupId });
      });
      io.to(groupId).emit('group_members_updated', { groupId });
      io.to(groupId).emit('receive_group_message', {
        room: groupId,
        sender: 'System',
        senderId: req.user.id,
        text: actionText,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ msg: 'Members added successfully' });
  } catch (err) {
    console.error('Error adding members:', err);
    res.status(500).json({ msg: 'Server Error adding members' });
  }
});

// Remove a member or Leave Group (WhatsApp style)
router.delete('/:id/members/:userId', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const targetUserId = req.params.userId;
  const isLeavingSelf = targetUserId === req.user.id;

  try {
    const requesterRole = await getMemberRole(groupId, req.user.id);
    if (!requesterRole) return res.status(403).json({ msg: 'You are not a member of this group' });

    // If removing someone else, requester must be admin
    if (!isLeavingSelf && requesterRole !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can remove participants' });
    }

    // Target user info
    const { data: targetUser } = await supabase
      .from('users')
      .select('username')
      .eq('id', targetUserId)
      .single();

    const targetName = targetUser ? targetUser.username : 'Participant';

    // Remove from group_members
    const { error: deleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (deleteError) throw deleteError;

    // Check remaining members
    const { data: remainingMembers } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    let systemMsg = isLeavingSelf
      ? `🚪 ${targetName} left the group.`
      : `🚫 ${req.user.username} removed ${targetName}.`;

    // If an admin left and no admins remain, promote oldest member to admin
    if (remainingMembers && remainingMembers.length > 0) {
      const hasAdmin = remainingMembers.some(m => m.role === 'admin');
      if (!hasAdmin) {
        const newAdminId = remainingMembers[0].user_id;
        await supabase
          .from('group_members')
          .update({ role: 'admin' })
          .eq('group_id', groupId)
          .eq('user_id', newAdminId);

        const { data: newAdminUser } = await supabase
          .from('users')
          .select('username')
          .eq('id', newAdminId)
          .single();

        systemMsg += ` 🛡️ ${newAdminUser ? newAdminUser.username : 'A member'} is now a group admin.`;
      }
    } else {
      // No members left, delete the group
      await supabase.from('groups').delete().eq('id', groupId).catch(() => {});
      await supabase.from('messages').delete().eq('room', groupId).catch(() => {});
    }

    await supabase.from('messages').insert([{
      room: groupId,
      sender: 'System',
      senderId: req.user.id,
      text: systemMsg
    }]).catch(() => {});

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId).emit('removed_from_group', { groupId });
      io.to(groupId).emit('group_members_updated', { groupId });
      io.to(groupId).emit('receive_group_message', {
        room: groupId,
        sender: 'System',
        senderId: req.user.id,
        text: systemMsg,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ msg: isLeavingSelf ? 'You left the group' : `${targetName} was removed` });
  } catch (err) {
    console.error('Error removing member:', err);
    res.status(500).json({ msg: 'Server Error removing member' });
  }
});

// Promote or Demote Admin (WhatsApp style)
router.put('/:id/members/:userId/role', verifyToken, async (req, res) => {
  const groupId = req.params.id;
  const targetUserId = req.params.userId;
  const { role } = req.body; // 'admin' or 'member'

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ msg: 'Invalid role' });
  }

  try {
    const requesterRole = await getMemberRole(groupId, req.user.id);
    if (requesterRole !== 'admin') {
      return res.status(403).json({ msg: 'Only group admins can change participant roles' });
    }

    const { error: updateError } = await supabase
      .from('group_members')
      .update({ role })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (updateError) throw updateError;

    const { data: targetUser } = await supabase
      .from('users')
      .select('username')
      .eq('id', targetUserId)
      .single();

    const targetName = targetUser ? targetUser.username : 'Participant';
    const actionText = role === 'admin'
      ? `🛡️ ${req.user.username} made ${targetName} a group admin.`
      : `🛡️ ${req.user.username} dismissed ${targetName} as admin.`;

    await supabase.from('messages').insert([{
      room: groupId,
      sender: 'System',
      senderId: req.user.id,
      text: actionText
    }]).catch(() => {});

    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('group_members_updated', { groupId });
      io.to(groupId).emit('receive_group_message', {
        room: groupId,
        sender: 'System',
        senderId: req.user.id,
        text: actionText,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ msg: `Role updated to ${role}` });
  } catch (err) {
    console.error('Error updating member role:', err);
    res.status(500).json({ msg: 'Server Error updating role' });
  }
});

// Delete group completely (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  const groupId = req.params.id;

  try {
    const requesterRole = await getMemberRole(groupId, req.user.id);
    if (requesterRole !== 'admin') {
      return res.status(403).json({ msg: 'Only group admins can delete the group' });
    }

    // Delete members, messages, and group
    await supabase.from('group_members').delete().eq('group_id', groupId);
    await supabase.from('messages').delete().eq('room', groupId);
    const { error: groupDeleteError } = await supabase.from('groups').delete().eq('id', groupId);

    if (groupDeleteError) throw groupDeleteError;

    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('group_deleted', { groupId });
    }

    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ msg: 'Server Error deleting group' });
  }
});

// Get group messages
router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const role = await getMemberRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(403).json({ msg: 'Not a member of this group' });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room', req.params.id)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching group messages:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;


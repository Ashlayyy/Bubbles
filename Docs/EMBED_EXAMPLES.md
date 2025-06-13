# 🎨 Discord Embed Examples

This document shows how various embeds will appear in Discord with visual descriptions and implementation details.

---

## **🎵 Music System Embeds**

### **Now Playing Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎵 Now Playing                                              │
├─────────────────────────────────────────────────────────────┤
│ [Thumbnail]  Rick Astley - Never Gonna Give You Up         │ 
│  🎼         ━━━━━━━━━━━━━━━━━━ 2:45 / 3:32                  │
│                                                             │
│ 🎤 Artist: Rick Astley                                     │
│ ⏱️ Duration: 3:32                                          │
│ 👤 Requested by: @username                                 │
│ 📊 Volume: 75%                                             │
│ 🔄 Loop: Off                                               │
│                                                             │
│ [⏸️ Pause] [⏭️ Skip] [🔀 Shuffle] [🔁 Loop] [⏹️ Stop]      │
└─────────────────────────────────────────────────────────────┘
Color: Blue (#3498db)
Footer: Queue • 5 songs remaining
```

### **Queue Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Music Queue (12 songs)                                  │
├─────────────────────────────────────────────────────────────┤
│ 🔊 **Currently Playing:**                                  │
│ Rick Astley - Never Gonna Give You Up (2:45/3:32)         │
│                                                             │
│ 📜 **Up Next:**                                            │
│ 1. Darude - Sandstorm (3:45) - @user1                     │
│ 2. Queen - Bohemian Rhapsody (5:55) - @user2              │
│ 3. The Beatles - Hey Jude (7:11) - @user3                 │
│ 4. Led Zeppelin - Stairway to Heaven (8:02) - @user4      │
│ 5. Pink Floyd - Wish You Were Here (5:34) - @user5        │
│                                                             │
│ ... and 7 more songs                                       │
│                                                             │
│ ⏱️ Total Duration: 45:32                                   │
│                                                             │
│ [📋 Full Queue] [🔀 Shuffle] [🗑️ Clear]                    │
└─────────────────────────────────────────────────────────────┘
Color: Purple (#9b59b6)
```

---

## **⚖️ Moderation Embeds**

### **Moderation Action Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚖️ Moderation Action - Server Name                         │
├─────────────────────────────────────────────────────────────┤
│ 👤 User: @BadUser#1234 (ID: 123456789)                     │
│ 🔨 Action: Temporary Ban                                   │
│ 📋 Case #: 42                                              │
│ ⏱️ Duration: 7 days                                        │
│ 📝 Reason: Repeated rule violations                        │
│ 👮 Moderator: @ModeratorName                               │
│ 📅 Date: January 15, 2024 at 3:45 PM                      │
│                                                             │
│ 🔗 Evidence:                                               │
│ • Screenshot: https://cdn.discord.com/...                 │
│ • Message Link: https://discord.com/channels/...          │
│                                                             │
│ 📝 Appeal This Action                                      │
│ Click here to submit an appeal if you believe this action  │
│ was issued unfairly: [Appeal Form](https://...)           │
└─────────────────────────────────────────────────────────────┘
Color: Red (#e74c3c)
Footer: Case ID: abc123def456 • expires in 6 days, 23 hours
```

### **Case Lookup Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Case #42 - @BadUser#1234                                │
├─────────────────────────────────────────────────────────────┤
│ 👤 **User:** BadUser#1234 (123456789)                      │
│ 🔨 **Action:** Temporary Ban                               │
│ ⏱️ **Duration:** 7 days                                    │
│ 📅 **Date:** Jan 15, 2024 3:45 PM                         │
│ 👮 **Moderator:** ModeratorName                            │
│ 📊 **Severity:** High                                      │
│ 🏷️ **Points:** 10                                          │
│ ✅ **Status:** Active                                      │
│                                                             │
│ 📝 **Reason:**                                             │
│ Repeated rule violations including spam and harassment     │
│                                                             │
│ 🔗 **Evidence:**                                           │
│ • Screenshot evidence                                      │
│ • Chat logs from #general                                 │
│                                                             │
│ 📋 **Notes:** (2)                                         │
│ • User warned previously on Jan 10                        │
│ • Pattern of escalating behavior                          │
│                                                             │
│ [📝 Add Note] [📞 Appeal] [🔓 Unban]                       │
└─────────────────────────────────────────────────────────────┘
Color: Orange (#f39c12)
Footer: Expires in 6 days, 23 hours • Can be appealed
```

---

## **🎫 Ticket System Embeds**

### **Ticket Created Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎫 Support Ticket Created                                  │
├─────────────────────────────────────────────────────────────┤
│ 🎟️ **Ticket ID:** #0042                                   │
│ 👤 **Created by:** @username#1234                          │
│ 📂 **Category:** Technical Support                         │
│ 🔴 **Priority:** High                                      │
│ 📅 **Created:** Jan 15, 2024 at 4:20 PM                   │
│                                                             │
│ 📝 **Issue Description:**                                  │
│ Bot commands not working in #general channel. Getting      │
│ permission errors when trying to use music commands.       │
│                                                             │
│ 📋 **Next Steps:**                                         │
│ • A staff member will respond within 30 minutes           │
│ • Please provide any additional details                    │
│ • Use buttons below to manage this ticket                  │
│                                                             │
│ [🔒 Close] [👤 Claim] [📋 Transcript] [⚠️ Priority]        │
└─────────────────────────────────────────────────────────────┘
Color: Purple (#9b59b6)
Footer: Ticket #0042 • Average response time: 15 minutes
```

### **Ticket Management Panel**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎫 Ticket #0042 - Management Panel                         │
├─────────────────────────────────────────────────────────────┤
│ 📊 **Status:** Open - Claimed by @StaffMember              │
│ ⏱️ **Open for:** 25 minutes                               │
│ 💬 **Messages:** 8                                        │
│ 👥 **Participants:** 3                                    │
│                                                             │
│ 🔧 **Available Actions:**                                  │
│                                                             │
│ [👤 Add User] [➖ Remove User] [📋 Generate Transcript]     │
│ [⚠️ Set Priority] [📂 Change Category] [🔒 Close Ticket]   │
│                                                             │
│ 📈 **Activity:**                                           │
│ • 4:20 PM - Ticket created                                │
│ • 4:22 PM - Claimed by @StaffMember                       │
│ • 4:35 PM - Priority set to High                          │
│ • 4:45 PM - User provided logs                            │
└─────────────────────────────────────────────────────────────┘
Color: Blue (#3498db)
```

---

## **🎉 Welcome/Events Embeds**

### **Welcome Message**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎉 Welcome to Awesome Server!                              │
├─────────────────────────────────────────────────────────────┤
│                  [Welcome Banner Image]                    │
│                                                             │
│ 👋 Hey @NewUser#1234, welcome to our community!           │
│                                                             │
│ 🎯 **You are our 1,337th member!**                        │
│                                                             │
│ 📋 **Quick Start:**                                        │
│ • Read the rules in #rules                                 │
│ • Introduce yourself in #introductions                     │
│ • Get roles in #role-selection                             │
│ • Join the conversation in #general                        │
│                                                             │
│ 🎁 **New Member Perks:**                                   │
│ • Free starter coins: 100 🪙                              │
│ • Welcome role: @New Member                                │
│ • Access to newcomer channels                              │
│                                                             │
│ 💬 **Need Help?** Create a ticket in #support             │
│                                                             │
│ [📋 Rules] [👋 Introduce] [🎭 Roles] [❓ Support]          │
└─────────────────────────────────────────────────────────────┘
Color: Gold (#f1c40f)
Footer: Welcome to the family! 🎉
```

### **Server Milestone**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎊 Server Milestone Reached!                               │
├─────────────────────────────────────────────────────────────┤
│                   [Celebration GIF]                        │
│                                                             │
│ 🎯 **1,500 Members Reached!**                             │
│                                                             │
│ 📈 **Growth Stats:**                                       │
│ • Started: 6 months ago                                    │
│ • Average daily joins: 8.3 members                        │
│ • Most active day: 47 joins                               │
│ • Retention rate: 89%                                      │
│                                                             │
│ 🏆 **Thank you to our amazing community!**                │
│                                                             │
│ 🎁 **Celebration Rewards:**                               │
│ • All members get 500 bonus coins                         │
│ • Special milestone role for active members               │
│ • Exclusive emoji unlock                                   │
│                                                             │
│ 🎯 **Next Goal:** 2,000 members                           │
└─────────────────────────────────────────────────────────────┘
Color: Rainbow gradient (#ff0000 to #9400d3)
Footer: Thank you for making this community amazing! ❤️
```

---

## **📊 Server Info Embeds**

### **Server Information**
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Awesome Server - Information                            │
├─────────────────────────────────────────────────────────────┤
│ [Server Icon]                                              │
│                                                             │
│ 👑 **Owner:** ServerOwner#0001                             │
│ 📅 **Created:** March 15, 2023 (10 months ago)            │
│ 🌍 **Region:** US East                                     │
│ 🔒 **Verification:** Medium                                │
│ 📋 **Description:** The best Discord server ever!         │
│                                                             │
│ 📊 **Statistics:**                                         │
│ 👥 Members: 1,337 (1,205 humans, 132 bots)               │
│ 🟢 Online: 234 • 🟡 Idle: 89 • 🔴 DND: 12 • ⚪ Offline │
│ 📝 Channels: 45 (25 text, 15 voice, 5 categories)        │
│ 🎭 Roles: 28                                               │
│ 😀 Emojis: 67/100                                         │
│ 🔗 Boosts: 15 (Level 2)                                   │
│                                                             │
│ 🎯 **Features:**                                           │
│ ✅ Community Server  ✅ Welcome Screen                     │
│ ✅ Server Discovery  ✅ Invite Splash                      │
│ ✅ Banner           ✅ Animated Icon                       │
│                                                             │
│ [📋 Channels] [🎭 Roles] [😀 Emojis] [📈 Analytics]       │
└─────────────────────────────────────────────────────────────┘
Color: Blurple (#5865f2)
Footer: Server ID: 123456789012345678
```

---

## **🔍 User Info Embeds**

### **User Information**
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 User Information - username#1234                        │
├─────────────────────────────────────────────────────────────┤
│ [User Avatar]                                              │
│                                                             │
│ 🏷️ **Display Name:** Cool Username                        │
│ 🆔 **User ID:** 123456789012345678                        │
│ 📅 **Account Created:** Jan 1, 2020 (4 years ago)         │
│ 📅 **Joined Server:** Dec 15, 2023 (1 month ago)          │
│ 🎂 **Account Age:** 4 years, 15 days                      │
│ 📱 **Status:** 🟢 Online (Mobile)                         │
│                                                             │
│ 🎭 **Roles:** (5)                                         │
│ @VIP @Active Member @Music Lover @Helper @everyone        │
│                                                             │
│ 🎮 **Activity:**                                           │
│ 🎵 Listening to Spotify                                   │
│ "Bohemian Rhapsody" by Queen                              │
│                                                             │
│ 📊 **Server Stats:**                                       │
│ 💬 Messages: 2,847                                        │
│ 🏆 Level: 15 (2,340/2,500 XP)                            │
│ 🪙 Balance: 1,250 coins                                   │
│ ⭐ Reputation: +47                                         │
│                                                             │
│ 🚨 **Moderation:** Clean record ✅                        │
│                                                             │
│ [💰 Balance] [📊 Stats] [🏆 Rank] [⚖️ Moderation]         │
└─────────────────────────────────────────────────────────────┘
Color: User's role color or default
Footer: Last seen: 2 minutes ago
```

---

## **🎮 Fun Commands Embeds**

### **Poll Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Poll by @username                                       │
├─────────────────────────────────────────────────────────────┤
│ **What's your favorite music genre?**                     │
│                                                             │
│ 🎸 **Rock** ━━━━━━━━━━ 45% (18 votes)                     │
│ 🎵 **Pop** ━━━━━ 25% (10 votes)                           │
│ 🎤 **Hip Hop** ━━━ 15% (6 votes)                          │
│ 🎹 **Classical** ━━ 10% (4 votes)                         │
│ 🎺 **Jazz** ━ 5% (2 votes)                                │
│                                                             │
│ 👥 **Total Votes:** 40                                    │
│ ⏰ **Time Remaining:** 23 hours, 45 minutes               │
│                                                             │
│ *Click the reactions below to vote!*                       │
└─────────────────────────────────────────────────────────────┘
Color: Green (#2ecc71)
Footer: Multiple choice • Ends Jan 16, 2024 at 4:30 PM
Reactions: 🎸 🎵 🎤 🎹 🎺
```

### **Giveaway Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎉 GIVEAWAY 🎉                                             │
├─────────────────────────────────────────────────────────────┤
│                   [Prize Image/GIF]                        │
│                                                             │
│ 🏆 **Prize:** Discord Nitro (1 Month)                     │
│ 👑 **Host:** @AdminUser                                   │
│                                                             │
│ 📋 **Requirements:**                                       │
│ ✅ Must be a server member                                 │
│ ✅ Account older than 30 days                             │
│ ✅ React with 🎉 to enter                                 │
│                                                             │
│ 👥 **Entries:** 127 people                                │
│ 🎯 **Winners:** 1 person                                  │
│ ⏰ **Ends:** In 2 days, 14 hours                         │
│                                                             │
│ 📅 **Ends:** Jan 18, 2024 at 6:00 PM                     │
│                                                             │
│ 🎊 **React with 🎉 to enter the giveaway!**              │
│                                                             │
│ 🍀 Good luck to everyone!                                 │
└─────────────────────────────────────────────────────────────┘
Color: Bright Yellow (#ffff00)
Footer: Hosted by AdminUser • React to enter!
```

---

## **⚠️ Error/Warning Embeds**

### **Error Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Command Error                                           │
├─────────────────────────────────────────────────────────────┤
│ 🚫 **Missing Permissions**                                │
│                                                             │
│ You don't have permission to use this command.            │
│                                                             │
│ 📋 **Required Permissions:**                               │
│ • Manage Messages                                          │
│ • Kick Members                                             │
│                                                             │
│ 💡 **Suggestion:**                                         │
│ Contact a server administrator for help.                   │
│                                                             │
│ 🔗 **Related Commands:**                                   │
│ • `/help permissions` - View permission info              │
│ • `/support` - Get help from staff                        │
└─────────────────────────────────────────────────────────────┘
Color: Red (#e74c3c)
Footer: Error Code: MISSING_PERMISSIONS
```

### **Success Embed**
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Action Successful                                       │
├─────────────────────────────────────────────────────────────┤
│ 🎉 **User Successfully Banned**                           │
│                                                             │
│ 👤 User: @BadUser#1234                                    │
│ ⏱️ Duration: 7 days                                       │
│ 📋 Case #: 42                                             │
│ 📝 Reason: Spam and harassment                            │
│                                                             │
│ ✉️ User has been notified via DM                          │
│ 📋 Case has been logged in the database                   │
│ 🔄 Action has been queued for processing                  │
└─────────────────────────────────────────────────────────────┘
Color: Green (#2ecc71)
Footer: Completed at Jan 15, 2024 4:45 PM
```

---

## **🔧 Implementation Code Examples**

### **Basic Embed Template**
```typescript
import { EmbedBuilder } from 'discord.js';

// Music embed example
const musicEmbed = new EmbedBuilder()
  .setTitle('🎵 Now Playing')
  .setDescription('Rick Astley - Never Gonna Give You Up')
  .setColor('#3498db')
  .setThumbnail('https://example.com/album-art.jpg')
  .addFields(
    { name: '🎤 Artist', value: 'Rick Astley', inline: true },
    { name: '⏱️ Duration', value: '3:32', inline: true },
    { name: '👤 Requested by', value: '@username', inline: true }
  )
  .setFooter({ text: 'Queue • 5 songs remaining' })
  .setTimestamp();
```

### **Dynamic Embed Colors**
```typescript
const embedColors = {
  success: '#2ecc71',
  error: '#e74c3c', 
  warning: '#f39c12',
  info: '#3498db',
  music: '#9b59b6',
  moderation: '#e74c3c',
  ticket: '#9b59b6'
};
```

### **Interactive Embed with Buttons**
```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const buttons = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause')
      .setLabel('⏸️ Pause')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('⏭️ Skip')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('⏹️ Stop')
      .setStyle(ButtonStyle.Danger)
  );

await interaction.reply({ 
  embeds: [musicEmbed], 
  components: [buttons] 
});
```

---

*These embed examples showcase the visual design and user experience that will make your Discord bot stand out with professional, interactive, and informative messages.* 
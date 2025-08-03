# Command Permission Updates TODO

## Priority 1: Admin Commands (ADMIN level)

- [ ] alias.ts - Add moderator permissions
- [ ] appeals.ts - Already has 0, keep as is
- [ ] automod-advanced.ts - Add moderator permissions
- [ ] automod.ts - Add moderator permissions
- [ ] cleanup.ts - Add administrator permissions
- [ ] clear.ts - Add administrator permissions
- [ ] compliment.ts - Add administrator permissions
- [ ] config.ts - Already has 0, keep as is
- [ ] permissions.ts - Add administrator permissions
- [ ] ping.ts - Already has 0, keep as is
- [ ] rbac.ts - Already has 0, keep as is
- [ ] reactionroles.ts - Add administrator permissions
- [ ] server.ts - Add administrator permissions
- [ ] serverinfo.ts - Already has 0, keep as is
- [ ] setup.ts - Already has 0, keep as is
- [ ] ticket-assign.ts - Add administrator permissions
- [ ] ticket.ts - Add administrator permissions
- [ ] userinfo.ts - Add administrator permissions
- [ ] welcome.ts - Already has 0, keep as is

## Priority 2: Moderation Commands (MODERATOR level)

- [ ] ban.ts - Add ban members permission
- [ ] bulk.ts - Add administrator permissions
- [ ] case.ts - Add moderator permissions
- [ ] kick.ts - Add kick members permission
- [ ] lookup.ts - Add moderator permissions
- [ ] massban.ts - Add administrator permissions
- [ ] note.ts - Add moderator permissions
- [ ] poll.ts - Add moderator permissions
- [ ] purge.ts - Add manage messages permission
- [ ] timeout.ts - Add moderate members permission
- [ ] unban.ts - Add ban members permission
- [ ] untimeout.ts - Add moderate members permission
- [ ] warn.ts - Add moderate members permission

## Priority 3: Context Menu Commands

- [ ] reportMessage.ts - Already has 0, keep as is
- [ ] banUser.ts - Already has ban members, keep as is
- [ ] kickUser.ts - Already has kick members, keep as is
- [ ] purgeFromUser.ts - Already has manage messages, keep as is
- [ ] timeoutUser.ts - Already has moderate members, keep as is
- [ ] warnUser.ts - Add moderate members permission

## Priority 4: Other Commands

- [ ] automation commands - Add administrator permissions
- [ ] custom commands - Already has 0, keep as is
- [ ] dev commands - Add developer permissions (0)
- [ ] economy commands - Public (no restrictions)
- [ ] entertainment commands - Public (no restrictions)
- [ ] events commands - Public (no restrictions)
- [ ] general commands - Public (no restrictions)
- [ ] giveaways commands - Add moderator permissions
- [ ] leveling commands - Public (no restrictions)
- [ ] music commands - Public (no restrictions)
- [ ] polls commands - Public (no restrictions)
- [ ] reminders commands - Public (no restrictions)

## Permission Levels:

- PUBLIC: No .setDefaultMemberPermissions() - visible to everyone
- MODERATOR: .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
- ADMIN: .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
- DEVELOPER: .setDefaultMemberPermissions(0) - hidden from everyone

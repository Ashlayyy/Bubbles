
export interface Role {
  roleId: string;
  roleName: string;
}

export interface ReactionMapping {
  emoji: string;
  roles: Role[];
  duration?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

export interface ReactionRoleMessage {
  id: string;
  channelId:string;
  channelName: string;
  messageId: string;
  messageContent: string;
  mappings: ReactionMapping[];
  exclusive?: boolean;
  prerequisiteRoles?: Role[];
  removeOnUnreact?: boolean;
}

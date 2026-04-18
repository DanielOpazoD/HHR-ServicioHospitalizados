import type { ModuleType, NavItemConfig } from '@/constants/navigationConfig';

interface ResolveNavbarMenuActionInput {
  item: NavItemConfig;
}

interface NavbarMenuActionResolution {
  moduleToChange?: ModuleType;
}

export const resolveNavbarMenuAction = ({
  item,
}: ResolveNavbarMenuActionInput): NavbarMenuActionResolution => {
  if (item.actionType === 'MODULE_CHANGE') {
    return { moduleToChange: item.module };
  }

  return {};
};

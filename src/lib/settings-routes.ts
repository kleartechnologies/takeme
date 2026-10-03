export function isSettingsUtilityPath(pathname: string) {
  return pathname === "/profile/settings" || pathname.startsWith("/profile/settings/")
    || pathname === "/profile/locations" || pathname === "/notification-preferences";
}

type IconBadgeProps = {
  label: string;
  tone?: "primary" | "warning" | "danger" | "muted";
  size?: "sm" | "md" | "lg";
};

export function IconBadge({ label, tone = "primary", size = "md" }: IconBadgeProps) {
  return (
    <span className={`icon-badge icon-badge--${tone} icon-badge--${size}`} aria-hidden="true">
      {label}
    </span>
  );
}

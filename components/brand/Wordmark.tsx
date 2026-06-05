import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
};

/**
 * Bugatti-spec wordmark: Display face, 14px, 6px letter-spacing, uppercase.
 * Widest tracking in the system.
 */
export function Wordmark({ className, label = "SARANG'S JOB BOARD" }: Props) {
  return <span className={cn("wordmark", className)}>{label}</span>;
}

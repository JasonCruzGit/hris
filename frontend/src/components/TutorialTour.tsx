import { useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { hasCompletedTour, markTourCompleted } from "../lib/tourStorage";

type Variant = "staff" | "employee";

function selectorExists(sel: string): boolean {
  try {
    return !!document.querySelector(sel);
  } catch {
    return false;
  }
}

function filterResolvableSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (step.element == null) return true;
    if (typeof step.element === "string") return selectorExists(step.element);
    return true;
  });
}

function buildSteps(variant: Variant): DriveStep[] {
  const md = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  const welcome: DriveStep =
    variant === "staff"
      ? {
          popover: {
            title: "Welcome to Control Center",
            description:
              "This short tour shows where to navigate, view alerts, and read page content. You can skip anytime with the × button.",
          },
        }
      : {
          popover: {
            title: "Welcome to the Employee portal",
            description:
              "Here’s a quick overview of self-service HR: navigation, notifications, and where page content appears.",
          },
        };

  const steps: DriveStep[] = [welcome];

  if (variant === "staff") {
    if (md && selectorExists('[data-tour="staff-sidebar"]')) {
      steps.push({
        element: '[data-tour="staff-sidebar"]',
        popover: {
          title: "Sidebar navigation",
          description:
            "Jump to Dashboard, core HR, talent tools, People, and Workspace. What you see depends on your role.",
          side: "right",
          align: "start",
        },
      });
    }
    steps.push(
      {
        element: '[data-tour="staff-header"]',
        popover: {
          title: "Top bar",
          description: "Open notifications, switch theme, see your account, or sign out.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: '[data-tour="staff-main"]',
        popover: {
          title: "Main content",
          description: "The selected module loads here—reports, approvals, lists, and forms.",
          side: "top",
          align: "center",
        },
      }
    );
    return filterResolvableSteps(steps);
  }

  if (md && selectorExists('[data-tour="employee-sidebar"]')) {
    steps.push({
      element: '[data-tour="employee-sidebar"]',
      popover: {
        title: "Navigation",
        description: "Access Home, leave, attendance, payroll, performance, training, profile, and workspace links.",
        side: "right",
        align: "start",
      },
    });
  } else if (!md && selectorExists('[data-tour="employee-menu"]')) {
    steps.push({
      element: '[data-tour="employee-menu"]',
      popover: {
        title: "Menu",
        description: "On smaller screens, open this menu to reach the same links as the sidebar.",
        side: "bottom",
        align: "start",
      },
    });
  }

  if (selectorExists('[data-tour="employee-notifications"]')) {
    steps.push({
      element: '[data-tour="employee-notifications"]',
      popover: {
        title: "Notifications",
        description: "Unread items show a badge. New alerts can also appear as a toast with a short sound.",
        side: "bottom",
        align: "end",
      },
    });
  }

  steps.push({
    element: '[data-tour="employee-main"]',
    popover: {
      title: "Main content",
      description: "Forms, balances, and details for the page you opened appear in this area.",
      side: "top",
      align: "center",
    },
  });

  return filterResolvableSteps(steps);
}

type Props = {
  variant: "staff" | "employee";
  userId: string | undefined;
};

export function TutorialTour({ variant, userId }: Props) {
  const skipPersistRef = useRef(false);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    skipPersistRef.current = false;
    if (!userId) return;
    if (hasCompletedTour(userId, variant)) return;

    const timer = window.setTimeout(() => {
      const steps = buildSteps(variant);
      if (steps.length === 0) return;

      const d = driver({
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        animate: true,
        allowClose: true,
        overlayOpacity: 0.55,
        steps,
        onDestroyed: () => {
          if (!skipPersistRef.current) {
            markTourCompleted(userId, variant);
          }
        },
      });

      driverRef.current = d;
      d.drive();
    }, 700);

    return () => {
      window.clearTimeout(timer);
      skipPersistRef.current = true;
      const inst = driverRef.current;
      driverRef.current = null;
      if (inst?.isActive()) {
        inst.destroy();
      }
    };
  }, [userId, variant]);

  return null;
}

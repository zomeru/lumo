import { Button } from "./button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "./dialog";

export function ConfirmAction({
  label,
  message,
  disabled,
  onConfirm,
}: {
  label: string;
  message: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{label}?</AlertDialogTitle>
        <AlertDialogDescription>{message}</AlertDialogDescription>
        <div className="mt-2 flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={disabled} onClick={onConfirm}>
              Confirm {label.toLowerCase()}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

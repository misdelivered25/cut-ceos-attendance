import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Undo2 } from "lucide-react";

interface ParsedMember {
  full_name: string;
  phone: string;
  email: string;
  program: string;
  department: string;
  status: "pending" | "success" | "error" | "duplicate";
  message?: string;
}

interface ImportDiffViewProps {
  original: ParsedMember[];
  corrected: ParsedMember[];
  onAccept: () => void;
  onRevert: () => void;
}

const DiffCell = ({ original, corrected }: { original: string; corrected: string }) => {
  if (original === corrected || (!original && !corrected)) {
    return <span className="text-sm">{corrected || "—"}</span>;
  }

  return (
    <div className="space-y-0.5">
      <div className="text-xs line-through text-muted-foreground/60">{original || "—"}</div>
      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{corrected || "—"}</div>
    </div>
  );
};

export const ImportDiffView = ({ original, corrected, onAccept, onRevert }: ImportDiffViewProps) => {
  const changedCount = original.reduce((count, orig, i) => {
    const corr = corrected[i];
    if (!corr) return count;
    const fields: (keyof ParsedMember)[] = ["full_name", "phone", "email", "program", "department"];
    const hasChange = fields.some((f) => orig[f] !== corr[f]);
    return count + (hasChange ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
            {changedCount} of {original.length} records modified
          </Badge>
          <span className="text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
            Green = AI correction
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRevert}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            Revert
          </Button>
          <Button size="sm" onClick={onAccept}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Accept Changes
          </Button>
        </div>
      </div>

      <div className="rounded-md border max-h-[50vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {corrected.map((corr, i) => {
              const orig = original[i];
              return (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell><DiffCell original={orig.full_name} corrected={corr.full_name} /></TableCell>
                  <TableCell><DiffCell original={orig.phone} corrected={corr.phone} /></TableCell>
                  <TableCell><DiffCell original={orig.email} corrected={corr.email} /></TableCell>
                  <TableCell><DiffCell original={orig.program} corrected={corr.program} /></TableCell>
                  <TableCell><DiffCell original={orig.department} corrected={corr.department} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

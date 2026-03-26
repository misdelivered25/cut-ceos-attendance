import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, UserPlus, Trash2, Edit, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImportMembersDialog } from "./ImportMembersDialog";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Member {
  id: string;
  member_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  program: string | null;
  department: string | null;
  profile_picture_url: string | null;
  joined_at: string;
  is_active: boolean;
}

export const MembersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    program: "",
    department: "",
  });
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Member[];
    },
  });

  const filteredMembers = members?.filter(
    (member) =>
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery)
  );

  const generateMemberId = async (): Promise<string> => {
    const { data, error } = await supabase.rpc("generate_member_id");
    if (error) throw error;
    return data;
  };

  const uploadProfilePicture = async (file: File, memberId: string): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${memberId}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let profilePictureUrl: string | null = null;
      const memberId = editingMember?.member_id || (await generateMemberId());

      if (profilePicture) {
        setUploading(true);
        profilePictureUrl = await uploadProfilePicture(profilePicture, memberId);
        setUploading(false);
      }

      if (editingMember) {
        const { error } = await supabase
          .from("members")
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            email: formData.email || null,
            program: formData.program || null,
            department: formData.department || null,
            ...(profilePictureUrl && { profile_picture_url: profilePictureUrl }),
          })
          .eq("id", editingMember.id);

        if (error) throw error;
        toast.success("Member updated successfully");
      } else {
        const { error } = await supabase.from("members").insert({
          member_id: memberId,
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email || null,
          program: formData.program || null,
          department: formData.department || null,
          profile_picture_url: profilePictureUrl,
          created_by: user?.id,
        });

        if (error) throw error;
        toast.success(`Member added with ID: ${memberId}`);
      }

      queryClient.invalidateQueries({ queryKey: ["members"] });
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("members").delete().eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete member");
    } else {
      toast.success("Member deleted");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    }
    setDeleteId(null);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      phone: member.phone,
      email: member.email || "",
      program: member.program || "",
      department: member.department || "",
    });
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      program: "",
      department: "",
    });
    setProfilePicture(null);
    setEditingMember(null);
    setShowAddDialog(false);
  };

  const handleExport = () => {
    if (!members || members.length === 0) {
      toast.error("No members to export");
      return;
    }

    const exportData = members.map((m, i) => ({
      "#": i + 1,
      "Member ID": m.member_id,
      "Full Name": m.full_name,
      Phone: m.phone,
      Email: m.email || "",
      Program: m.program || "",
      Department: m.department || "",
      "Joined Date": format(new Date(m.joined_at), "MMM d, yyyy"),
      Status: m.is_active ? "Active" : "Inactive",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `cut-ceos-members-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Members exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Members</h2>
          <p className="text-muted-foreground">Manage club members and their profiles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!members?.length}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.filter((m) => m.is_active).length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members?.filter((m) => {
                const joinDate = new Date(m.joined_at);
                const now = new Date();
                return joinDate.getMonth() === now.getMonth() && joinDate.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredMembers && filteredMembers.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.profile_picture_url || undefined} />
                          <AvatarFallback>
                            {member.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          {member.email && (
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{member.member_id}</code>
                    </TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>
                      {member.program && (
                        <div>
                          <div className="text-sm">{member.program}</div>
                          {member.department && (
                            <div className="text-xs text-muted-foreground">{member.department}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(member.joined_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? "default" : "secondary"}>
                        {member.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first member to get started</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
            <DialogDescription>
              {editingMember ? "Update member information" : "Fill in the details to add a new member"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="program">Program</Label>
                  <Input
                    id="program"
                    placeholder="e.g., Computer Science"
                    value={formData.program}
                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Engineering"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="picture">Profile Picture</Label>
                <Input
                  id="picture"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || uploading}>
                {loading ? (uploading ? "Uploading..." : "Saving...") : editingMember ? "Update" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this member? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

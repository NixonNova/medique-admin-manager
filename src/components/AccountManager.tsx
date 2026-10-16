"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { TreeItem, TreeItemLabel } from "@mui/x-tree-view/TreeItem";
import type { TreeItemProps } from "@mui/x-tree-view/TreeItem";
import { createClinic } from "@/app/actions/create-clinic";
import { createManagedUser } from "@/app/actions/create-user";
import { updateManagedClinic } from "@/app/actions/update-clinic";
import { updateManagedUserTypes } from "@/app/actions/update-user-types";
import type { Clinic } from "@/lib/clinics";
import {
  creatableRolesUnderParent,
  isRole,
  primaryRole,
  ROLE_LABELS,
  type Role,
} from "@/lib/roles";
import { treeParentId, type UserForTree } from "@/lib/tenancy";
import {
  buildUserTreeItems,
  canCreateUnderTreeNode,
  collectTreeItemIds,
  USER_TREE_ROOT_ID,
} from "@/lib/user-tree";
import WorkingDaysGenerationForm from "@/components/WorkingDaysGenerationForm";
import type { UserTypeOption } from "@/lib/user-types";

type AccountManagerProps = {
  users: UserForTree[];
  userTypes: UserTypeOption[];
  clinics: Clinic[];
  actorRole: Role | null;
  actorId: string;
};

type TreeUiContextValue = {
  openCreateUnder: (parentUserId: string) => void;
  canCreateOnNode: (nodeId: string) => boolean;
};

const TreeUiContext = createContext<TreeUiContextValue>({
  openCreateUnder: () => { },
  canCreateOnNode: () => false,
});

function userInfoTabA11yProps(index: number) {
  return {
    id: `user-info-tab-${index}`,
    "aria-controls": `user-info-tabpanel-${index}`,
  };
}

type UserInfoTabPanelProps = {
  children: React.ReactNode;
  index: number;
  value: number;
};

function UserInfoTabPanel({ children, index, value }: UserInfoTabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-info-tabpanel-${index}`}
      aria-labelledby={`user-info-tab-${index}`}
    >
      {value === index ? <Box sx={{ pt: 1 }}>{children}</Box> : null}
    </div>
  );
}

function generatePassword() {
  const digits = new Uint8Array(12);
  crypto.getRandomValues(digits);
  return Array.from(digits, (digit) => String(digit % 10)).join("");
}

const AddTreeItemLabel = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof TreeItemLabel> & { itemId?: string }
>(function AddTreeItemLabel({ children, itemId, ...other }, ref) {
  const { openCreateUnder, canCreateOnNode } = useContext(TreeUiContext);
  const canCreate = itemId ? canCreateOnNode(itemId) : false;

  return (
    <TreeItemLabel
      ref={ref}
      {...other}
      sx={{ display: "flex", alignItems: "center", gap: 1 }}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {canCreate && itemId ? (
        <IconButton
          size="small"
          aria-label="Add user"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openCreateUnder(itemId);
          }}
          sx={{
            marginLeft: "auto",
            padding: 0.25,
            opacity: 0,
            ".MuiTreeItem-content:hover &": {
              opacity: 1,
            },
          }}
        >
          <AddIcon sx={{ fontSize: 18 }} />
        </IconButton>
      ) : null}
    </TreeItemLabel>
  );
});

function AddTreeItem(props: TreeItemProps) {
  const { itemId } = props;
  const LabelSlot = useMemo(
    () =>
      forwardRef<HTMLDivElement, ComponentProps<typeof TreeItemLabel>>(function BoundTreeLabel(
        labelProps,
        ref,
      ) {
        return <AddTreeItemLabel ref={ref} itemId={itemId} {...labelProps} />;
      }),
    [itemId],
  );

  return (
    <TreeItem
      {...props}
      slots={{
        ...props.slots,
        label: LabelSlot,
      }}
    />
  );
}

export default function AccountManager({
  users,
  userTypes,
  clinics,
  actorRole,
  actorId,
}: AccountManagerProps) {
  const router = useRouter();
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const [createUnderUserId, setCreateUnderUserId] = useState<string | null>(null);
  const parentUser = createUnderUserId ? usersById.get(createUnderUserId) : null;
  const parentRole = primaryRole(parentUser?.role);
  const allowedRoles = creatableRolesUnderParent(actorRole, parentRole);
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">(allowedRoles[0] ?? "");
  const [selectedUserTypeIds, setSelectedUserTypeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clinicOpen, setClinicOpen] = useState(false);
  const [clinicDialogMode, setClinicDialogMode] = useState<"create" | "edit">("create");
  const [editingClinicId, setEditingClinicId] = useState<number | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [clinicPending, startClinicTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userInfoTab, setUserInfoTab] = useState(0);
  const selectedUser = selectedUserId ? usersById.get(selectedUserId) : null;
  const selectedUserRole = primaryRole(selectedUser?.role);
  const showUsersTab = selectedUserRole === "admin";
  const showClinicsTab = selectedUserRole === "admin";
  const showWorkingDaysTab = selectedUserRole === "user";
  const clinicsTabIndex = showUsersTab ? 1 : 0;
  const workingDaysTabIndex = (showUsersTab ? 1 : 0) + (showClinicsTab ? 1 : 0);
  const usersUnderAdmin = useMemo(() => {
    if (!selectedUser || !showUsersTab) {
      return [];
    }
    return users
      .filter(
        (user) => primaryRole(user.role) === "user" && treeParentId(user) === selectedUser.id,
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [selectedUser, showUsersTab, users]);

  const items = useMemo(() => buildUserTreeItems(users), [users]);
  const defaultExpandedItems = useMemo(() => collectTreeItemIds(items), [items]);

  const treeUi = useMemo<TreeUiContextValue>(
    () => ({
      openCreateUnder: (parentUserId: string) => {
        if (!actorRole) {
          return;
        }
        const node = usersById.get(parentUserId);
        if (!node || !canCreateUnderTreeNode(actorRole, actorId, node)) {
          return;
        }
        setDialogMode("create");
        setEditingUserId(null);
        setCreateUnderUserId(parentUserId);
        const roles = creatableRolesUnderParent(actorRole, primaryRole(node.role));
        setFullName("");
        setEmail("");
        setPassword("");
        setRole(roles[0] ?? "");
        setSelectedUserTypeIds([]);
        setError(null);
        setOpen(true);
      },
      canCreateOnNode: (nodeId: string) => {
        if (!actorRole || nodeId === USER_TREE_ROOT_ID || nodeId === "users-empty") {
          return false;
        }
        const node = usersById.get(nodeId);
        if (!node) {
          return false;
        }
        return canCreateUnderTreeNode(actorRole, actorId, node);
      },
    }),
    [actorId, actorRole, usersById],
  );

  function openEdit(user: UserForTree) {
    const currentRole = primaryRole(user.role);
    setDialogMode("edit");
    setEditingUserId(user.id);
    setCreateUnderUserId(null);
    setFullName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(currentRole ?? "");
    setSelectedUserTypeIds(user.userTypeIds ?? []);
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (pending) {
      return;
    }
    setOpen(false);
    setDialogMode("create");
    setEditingUserId(null);
    setCreateUnderUserId(null);
  }

  function openCreateClinic() {
    setClinicDialogMode("create");
    setEditingClinicId(null);
    setClinicName("");
    setClinicAddress("");
    setClinicError(null);
    setClinicOpen(true);
  }

  function openEditClinic(clinic: Clinic) {
    setClinicDialogMode("edit");
    setEditingClinicId(clinic.id);
    setClinicName(clinic.name);
    setClinicAddress(clinic.address);
    setClinicError(null);
    setClinicOpen(true);
  }

  function closeClinicDialog() {
    if (clinicPending) {
      return;
    }
    setClinicOpen(false);
    setClinicDialogMode("create");
    setEditingClinicId(null);
  }

  function onClinicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClinicError(null);

    if (clinicDialogMode === "edit") {
      if (!editingClinicId) {
        setClinicError("You cannot edit this clinic.");
        return;
      }

      startClinicTransition(async () => {
        const result = await updateManagedClinic({
          id: editingClinicId,
          name: clinicName,
          address: clinicAddress,
        });

        if (!result.ok) {
          setClinicError(result.error);
          return;
        }

        setClinicOpen(false);
        setClinicDialogMode("create");
        setEditingClinicId(null);
        router.refresh();
      });
      return;
    }

    startClinicTransition(async () => {
      const result = await createClinic({
        name: clinicName,
        address: clinicAddress,
      });

      if (!result.ok) {
        setClinicError(result.error);
        return;
      }

      setClinicOpen(false);
      router.refresh();
    });
  }

  async function copyPassword() {
    if (!password) {
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // Clipboard access can be denied by the browser.
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (dialogMode === "edit") {
      if (!editingUserId) {
        setError("You cannot edit this user.");
        return;
      }

      startTransition(async () => {
        const result = await updateManagedUserTypes({
          userId: editingUserId,
          userTypeIds: selectedUserTypeIds,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setOpen(false);
        setDialogMode("create");
        setEditingUserId(null);
        router.refresh();
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      setError("A user with this email already exists.");
      return;
    }

    startTransition(async () => {
      const result = await createManagedUser({
        name: fullName,
        email,
        password,
        role,
        parentUserId: createUnderUserId,
        userTypeIds: selectedUserTypeIds,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setCreateUnderUserId(null);
      router.refresh();
    });
  }

  const identityLocked = dialogMode === "edit" || pending;
  const displayedRoles = dialogMode === "edit" && isRole(role) ? [role] : allowedRoles;
  const canSave =
    dialogMode === "edit"
      ? Boolean(editingUserId)
      : Boolean(fullName.trim() && email.trim() && password && role);
  const parentLabel = parentUser?.email ?? "selected account";
  const canSaveClinic =
    clinicDialogMode === "edit"
      ? Boolean(editingClinicId && clinicName.trim() && clinicAddress.trim())
      : Boolean(clinicName.trim() && clinicAddress.trim());

  function isSelectableTreeItem(itemId: string) {
    return itemId !== USER_TREE_ROOT_ID && itemId !== "users-empty";
  }

  return (
    <TreeUiContext.Provider value={treeUi}>
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[30%_1fr]">
        <Paper elevation={3} className="min-w-0 w-full p-6 sm:p-8">
          <Typography variant="h5" component="h1" className="mb-6">
            Account Manager
          </Typography>
          <Stack spacing={2}>
            <RichTreeView
              key={users.map((user) => `${user.id}:${user.adminId}:${user.parentUserId}`).join(",")}
              aria-label="User accounts"
              items={items}
              defaultExpandedItems={defaultExpandedItems}
              selectedItems={selectedUserId}
              onSelectedItemsChange={(_event, itemId) => {
                if (typeof itemId === "string" && isSelectableTreeItem(itemId)) {
                  setSelectedUserId(itemId);
                  setUserInfoTab(0);
                }
              }}
              onItemClick={(_event, itemId) => {
                if (isSelectableTreeItem(itemId)) {
                  setSelectedUserId(itemId);
                  setUserInfoTab(0);
                }
              }}
              isItemDisabled={(item) => item.id === "users-empty"}
              slots={{ item: AddTreeItem }}
            />
          </Stack>
        </Paper>
        {selectedUser && (selectedUserRole === "admin" || selectedUserRole === "user") ? (
          <Paper elevation={3} className="min-w-0 w-full p-4 sm:p-5">
            <Typography variant="h6" component="h2" className="mb-2">
              User Info
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body1">
                <span className="font-semibold">Full Name:</span> {selectedUser.name}
              </Typography>
              <Typography variant="body1">
                <span className="font-semibold">Email:</span> {selectedUser.email}
              </Typography>
              <Typography variant="body1">
                <span className="font-semibold">Role:</span>{" "}
                {selectedUserRole ? ROLE_LABELS[selectedUserRole] : ""}
              </Typography>
            </Stack>
            <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 1.5 }}>
              <Tabs
                value={userInfoTab}
                onChange={(_event, newValue: number) => setUserInfoTab(newValue)}
                aria-label="User info sections"
              >
                {showUsersTab ? <Tab label="Users" {...userInfoTabA11yProps(0)} /> : null}
                {showClinicsTab ? (
                  <Tab label="Clinics" {...userInfoTabA11yProps(clinicsTabIndex)} />
                ) : null}
                {showWorkingDaysTab ? (
                  <Tab
                    label="Working Days Generator"
                    {...userInfoTabA11yProps(workingDaysTabIndex)}
                  />
                ) : null}
              </Tabs>
            </Box>
            {showUsersTab ? (
              <UserInfoTabPanel value={userInfoTab} index={0}>
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (selectedUser) {
                        treeUi.openCreateUnder(selectedUser.id);
                      }
                    }}
                  >
                    New User
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small" aria-label="Users under this admin">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Full Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>User Type</TableCell>
                        <TableCell sx={{ width: 56 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersUnderAdmin.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 2, color: "text.secondary" }}>
                            No users under this admin.
                          </TableCell>
                        </TableRow>
                      ) : (
                        usersUnderAdmin.map((user) => (
                          <TableRow key={user.id} hover>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.userTypeLabel ?? ""}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                aria-label={`Edit ${user.name}`}
                                onClick={() => openEdit(user)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </UserInfoTabPanel>
            ) : null}
            {showClinicsTab ? (
              <UserInfoTabPanel value={userInfoTab} index={clinicsTabIndex}>
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                  <Button variant="contained" onClick={openCreateClinic}>
                    New Clinic
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small" aria-label="Clinics">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Clinic Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                        <TableCell sx={{ width: 56 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clinics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 2, color: "text.secondary" }}>
                            No clinics.
                          </TableCell>
                        </TableRow>
                      ) : (
                        clinics.map((clinic) => (
                          <TableRow key={clinic.id} hover>
                            <TableCell>{clinic.id}</TableCell>
                            <TableCell>{clinic.name}</TableCell>
                            <TableCell>{clinic.address}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                aria-label={`Edit ${clinic.name}`}
                                onClick={() => openEditClinic(clinic)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </UserInfoTabPanel>
            ) : null}
            {showWorkingDaysTab ? (
              <UserInfoTabPanel value={userInfoTab} index={workingDaysTabIndex}>
                <WorkingDaysGenerationForm
                  accountKey={selectedUser.id}
                  userId={selectedUser.id}
                  clinics={clinics}
                />
              </UserInfoTabPanel>
            ) : null}
          </Paper>
        ) : (
          <div className="hidden min-w-0 lg:block" aria-hidden />
        )}
      </div>
      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <form onSubmit={onSubmit}>
          <DialogTitle>
            {dialogMode === "edit" ? "Edit user" : `Create user under ${parentLabel}`}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField
                label="Full Name"
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required={dialogMode === "create"}
                fullWidth
                disabled={identityLocked}
              />
              <TextField
                label="Email"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required={dialogMode === "create"}
                fullWidth
                disabled={identityLocked}
              />
              <TextField
                select
                label="Role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                required={dialogMode === "create"}
                fullWidth
                disabled={identityLocked}
              >
                {displayedRoles.map((option) => (
                  <MenuItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
              <FormControl component="fieldset" disabled={pending}>
                <FormLabel component="legend">User Type</FormLabel>
                <FormGroup row>
                  {userTypes.map((userType) => (
                    <FormControlLabel
                      key={userType.id}
                      control={
                        <Checkbox
                          checked={selectedUserTypeIds.includes(userType.id)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedUserTypeIds((current) =>
                              checked
                                ? [...current, userType.id]
                                : current.filter((id) => id !== userType.id),
                            );
                          }}
                        />
                      }
                      label={userType.name}
                    />
                  ))}
                </FormGroup>
              </FormControl>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <TextField
                  label="Password"
                  name="password"
                  value={password}
                  disabled
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={() => setPassword(generatePassword())}
                  disabled={identityLocked}
                >
                  Generate
                </Button>
                <Button
                  variant="outlined"
                  onClick={copyPassword}
                  disabled={identityLocked || !password}
                >
                  Copy
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={!canSave || pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={clinicOpen} onClose={closeClinicDialog} fullWidth maxWidth="sm">
        <form onSubmit={onClinicSubmit}>
          <DialogTitle>{clinicDialogMode === "edit" ? "Edit clinic" : "New clinic"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {clinicError ? <Alert severity="error">{clinicError}</Alert> : null}
              {clinicDialogMode === "edit" ? (
                <TextField label="ID" value={editingClinicId ?? ""} fullWidth disabled />
              ) : null}
              <TextField
                label="Clinic Name"
                name="clinicName"
                value={clinicName}
                onChange={(event) => setClinicName(event.target.value)}
                required
                fullWidth
                disabled={clinicPending}
              />
              <TextField
                label="Address"
                name="address"
                value={clinicAddress}
                onChange={(event) => setClinicAddress(event.target.value)}
                required
                fullWidth
                disabled={clinicPending}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeClinicDialog} disabled={clinicPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={!canSaveClinic || clinicPending}>
              {clinicPending ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </TreeUiContext.Provider>
  );
}

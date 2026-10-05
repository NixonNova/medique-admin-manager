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
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { TreeItem, TreeItemLabel } from "@mui/x-tree-view/TreeItem";
import type { TreeItemProps } from "@mui/x-tree-view/TreeItem";
import { createManagedUser } from "@/app/actions/create-user";
import {
  creatableRolesUnderParent,
  primaryRole,
  ROLE_LABELS,
  type Role,
} from "@/lib/roles";
import type { UserForTree } from "@/lib/tenancy";
import {
  buildUserTreeItems,
  canCreateUnderTreeNode,
  collectTreeItemIds,
  USER_TREE_ROOT_ID,
} from "@/lib/user-tree";
import WorkingDaysGenerationForm from "@/components/WorkingDaysGenerationForm";

type AccountManagerProps = {
  users: UserForTree[];
  actorRole: Role | null;
  actorId: string;
};

type TreeUiContextValue = {
  openCreateUnder: (parentUserId: string) => void;
  canCreateOnNode: (nodeId: string) => boolean;
};

const TreeUiContext = createContext<TreeUiContextValue>({
  openCreateUnder: () => {},
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
      {value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null}
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

export default function AccountManager({ users, actorRole, actorId }: AccountManagerProps) {
  const router = useRouter();
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const [createUnderUserId, setCreateUnderUserId] = useState<string | null>(null);
  const parentUser = createUnderUserId ? usersById.get(createUnderUserId) : null;
  const parentRole = primaryRole(parentUser?.role);
  const allowedRoles = creatableRolesUnderParent(actorRole, parentRole);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">(allowedRoles[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userInfoTab, setUserInfoTab] = useState(0);
  const selectedUser = selectedUserId ? usersById.get(selectedUserId) : null;
  const selectedUserRole = primaryRole(selectedUser?.role);

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
        setCreateUnderUserId(parentUserId);
        const roles = creatableRolesUnderParent(actorRole, primaryRole(node.role));
        setFullName("");
        setEmail("");
        setPassword("");
        setRole(roles[0] ?? "");
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

  function closeDialog() {
    if (pending) {
      return;
    }
    setOpen(false);
    setCreateUnderUserId(null);
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

  const canSave = Boolean(fullName.trim() && email.trim() && password && role);
  const parentLabel = parentUser?.email ?? "selected account";

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
                }
              }}
              onItemClick={(_event, itemId) => {
                if (isSelectableTreeItem(itemId)) {
                  setSelectedUserId(itemId);
                }
              }}
              isItemDisabled={(item) => item.id === "users-empty"}
              slots={{ item: AddTreeItem }}
            />
          </Stack>
        </Paper>
        {selectedUser ? (
          <Paper elevation={3} className="min-w-0 w-full p-8 sm:p-10">
            {selectedUserRole === "admin" ? (
              <>
                <Typography variant="h6" component="h2" className="mb-4">
                  User Info
                </Typography>
                <Stack spacing={1.5}>
                  <Typography variant="body1">
                    <span className="font-semibold">Full Name:</span> {selectedUser.name}
                  </Typography>
                  <Typography variant="body1">
                    <span className="font-semibold">Email:</span> {selectedUser.email}
                  </Typography>
                  <Typography variant="body1">
                    <span className="font-semibold">Role:</span> {ROLE_LABELS.admin}
                  </Typography>
                </Stack>
                <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 3 }}>
                  <Tabs
                    value={userInfoTab}
                    onChange={(_event, newValue: number) => setUserInfoTab(newValue)}
                    aria-label="User info sections"
                  >
                    <Tab label="Users" {...userInfoTabA11yProps(0)} />
                    <Tab label="Working Days Generation" {...userInfoTabA11yProps(1)} />
                  </Tabs>
                </Box>
                <UserInfoTabPanel value={userInfoTab} index={0}>
                  <Typography variant="body1" color="text.secondary">
                    Users tab placeholder — manage accounts and permissions here.
                  </Typography>
                </UserInfoTabPanel>
                <UserInfoTabPanel value={userInfoTab} index={1}>
                  <WorkingDaysGenerationForm accountKey={selectedUser.id} />
                </UserInfoTabPanel>
              </>
            ) : null}
          </Paper>
        ) : (
          <div className="hidden min-w-0 lg:block" aria-hidden />
        )}
      </div>
      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <form onSubmit={onSubmit}>
          <DialogTitle>Create user under {parentLabel}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField
                label="Full Name"
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                fullWidth
                disabled={pending}
              />
              <TextField
                label="Email"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
                disabled={pending}
              />
              <TextField
                select
                label="Role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                required
                fullWidth
                disabled={pending}
              >
                {allowedRoles.map((option) => (
                  <MenuItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
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
                  disabled={pending}
                >
                  Generate
                </Button>
                <Button variant="outlined" onClick={copyPassword} disabled={!password || pending}>
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
    </TreeUiContext.Provider>
  );
}

import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField, List, ListItem, ListItemText,
} from "@mui/material";
import './ProvisionAccessModal.scss';
import DeleteIcon from '@mui/icons-material/Delete';
import useDrivePicker from "react-google-drive-picker";
import { useEffect } from "react";

export default function ProvisionAccessModal(props) {
  const [openPicker, data, authResponse] = useDrivePicker();

  useEffect(() => {})

  const handleOpenPicker = () => {
    openPicker({
      // clientId: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID,
      developerKey: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_WEB_API_KEY,
      viewId: "DOCS",
      token: props.accessToken,
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
    })
  }

  const pickerCallback = (data) => {
    console.log('GOOGLE PICKER DATA', data)
  };

  return (
    <section>
      <Dialog maxWidth={'md'} fullWidth={true} open={props.openProvisionAccessDialog}>
        <DialogTitle className={'provision-access-header'}>
          Provision Access
        </DialogTitle>
        <DialogContent style={{ paddingBottom: '0'}}>
          <section className={'provision-access-current-controls'}>
            <h4>Current Access Control Conditions</h4>
            {props.humanizedAccessControlArray.length > 0 &&
              <List dense={true}>
                {props.humanizedAccessControlArray.map((accessControl, i) =>
                  <ListItem className={'provision-access-control-item'}
                    secondaryAction={
                      <IconButton onClick={() => props.removeIthAccessControlCondition(i)}>
                        <DeleteIcon />
                      </IconButton>
                    }>
                    <ListItemText
                      primary={accessControl}
                    />
                  </ListItem>
                )}
              </List>
            }
            {!props.humanizedAccessControlArray.length &&
              <span>No current access control conditions</span>
            }
          </section>
        </DialogContent>
        <DialogContent style={{ paddingTop: '0'}}>
          <section className={'provision-access-container'}>
            <Button variant={'outlined'} onClick={() => handleOpenPicker()}>Choose File</Button>
            <p>Google Drive Link</p>
            <TextField value={props.link} fullWidth autoFocus onChange={(e) => props.setLink(e.target.value)}/>
            <p>Permission Level</p>
            <FormControl fullWidth>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={props.role}
                onChange={(event) => props.setRole(event.target.value)}
              >{Object.entries(props.roleMap).map(([key, value], i) => (
                <MenuItem key={i} value={value}>{key}</MenuItem>
              ))}
              </Select>
            </FormControl>
          </section>
        </DialogContent>
        <DialogActions>
          <Button variant={'outlined'}
                  disabled={!props.link.length}
                  onClick={() => {
                    props.handleAddAccessControl()
                  }}>Add Access Control Conditions</Button>
          <Button disabled={!props.accessControlConditions.length} variant={'outlined'} onClick={() => props.handleGetShareLink()}>Get Share Link</Button>
          <Button variant={'outlined'} onClick={() => props.handleCancelProvisionAccessDialog()}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}

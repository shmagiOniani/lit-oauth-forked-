import './ServiceLinks.scss';
import {
  Button,
  Card,
  IconButton,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent, DialogActions, Tooltip
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from "react";
import { DateTime } from "luxon";
import { DATETIME_MED } from "luxon/src/impl/formats";

export default function ServiceLinks(props) {

  const [openDeleteWarningModal, setOpenDeleteWarningModal] = useState(false);
  const [deleteShareInfo, setDeleteShareInfo] = useState({});

  const handleOpenDeleteModal = (shareInfo) => {
    console.log('Share Info', shareInfo)
    setDeleteShareInfo(shareInfo);
    setOpenDeleteWarningModal(true);
  }

  const handleConfirmDelete = () => {
    props.handleDeleteLinkAction(deleteShareInfo);
    setOpenDeleteWarningModal(false);
  }

  const getAccessControlConditions = (accessControl) => {
    return JSON.parse(accessControl)[0].chain;
  }

  return (
    <section>
      <Card className={'links-card'}>
        <span className={'links-header'}>
          <h3>Your {props.serviceName} Files</h3>
          <Button variant='outlined' onClick={() => props.handleOpenProvisionAccessDialog()}>Provision Access</Button>
        </span>
        {/*{props.listOfShares && props.listOfShares.length && (<TableContainer component={Paper}>*/}
        <TableContainer component={Paper}>
          <Table sx={{minWidth: 650}}>
            <TableHead>
              <TableRow>
                <TableCell align="left">File Name</TableCell>
                <TableCell align="left">Requirements</TableCell>
                <TableCell align="left">File Type</TableCell>
                <TableCell align="left">Permission</TableCell>
                <TableCell align="left">Date Created</TableCell>
                <TableCell align="left">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.listOfShares.map((share, i) => (
                <TableRow
                  key={i}
                  sx={{'&:last-child td, &:last-child th': {border: 0}}}
                >
                  <TableCell component="th" scope="row">
                    {share.name}
                  </TableCell>
                  <TableCell align="left">{getAccessControlConditions(share.accessControlConditions)}</TableCell>
                  <TableCell align="left">{share.assetType}</TableCell>
                  <TableCell align="left">{share.role}</TableCell>
                  <TableCell align="left">{DateTime.fromISO(share.createdAt).toLocaleString(DATETIME_MED)}</TableCell>
                  <TableCell align="left">
                    <span className={'links-actions'}>
                      <IconButton size={'small'} onClick={props.handleEditLinkAction}>
                        <EditIcon/>
                      </IconButton>
                      <Tooltip title={'Copy share link'}>
                        <IconButton size={'small'} onClick={() => props.handleCopyLinkAction(share.id)}>
                          <LinkIcon/>
                        </IconButton>
                      </Tooltip>
                      {/*<IconButton size={'small'} onClick={props.handleDownloadLinkAction}>*/}
                      {/*  <DownloadIcon/>*/}
                      {/*</IconButton>*/}
                      <Tooltip title={'Delete link'}>
                        <IconButton size={'small'} onClick={() => handleOpenDeleteModal(share)}>
                          <DeleteIcon/>
                        </IconButton>
                      </Tooltip>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/*)}*/}
      </Card>
      <Dialog
        open={openDeleteWarningModal}
      >
        <DialogTitle>Warning</DialogTitle>
        <DialogContent>
          Are you sure you want to delete link titled <strong>{deleteShareInfo.name}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteWarningModal(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleConfirmDelete()}>Yes</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
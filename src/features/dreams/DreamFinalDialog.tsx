import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

export const DreamFinalDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  interpretation: string;
}> = ({ open, onClose, interpretation }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Толкование сна</DialogTitle>
    <DialogContent>
      <Typography>{interpretation}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Закрыть</Button>
    </DialogActions>
  </Dialog>
);
import BuildIcon from "@mui/icons-material/DataObject";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Chip,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { LogViewerComponent } from "../log-viewer";
import UTxOBuilder from "../utxo-builder";

type ToolPanelId = "utxo" | "logs";

interface ToolPanelProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: React.ReactNode;
}

const ToolPanel: React.FC<ToolPanelProps> = ({ title, subtitle, icon, expanded, onToggle, children }) => (
  <Accordion
    expanded={expanded}
    onChange={(_, isExpanded) => onToggle(isExpanded)}
    TransitionProps={{ unmountOnExit: true }}
    sx={{
      borderRadius: "12px !important",
      "&:before": { display: "none" },
      boxShadow: "none",
      border: "1px solid",
      borderColor: expanded ? "primary.200" : "grey.200",
      bgcolor: expanded ? "primary.50" : "white",
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: expanded ? "primary.100" : "grey.100" }}>{icon}</Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Box>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>{children}</AccordionDetails>
  </Accordion>
);

export const ToolsTab: React.FC = () => {
  const [expanded, setExpanded] = useState<ToolPanelId | null>("utxo");
  const toggle = (panel: ToolPanelId) => (isExpanded: boolean) => setExpanded(isExpanded ? panel : null);
  const iconSx = (panel: ToolPanelId) => ({
    fontSize: 20,
    color: expanded === panel ? "primary.main" : "grey.600",
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <ToolPanel
        title="UTxO Builder"
        subtitle="Create custom UTxO responses"
        icon={<BuildIcon sx={iconSx("utxo")} />}
        expanded={expanded === "utxo"}
        onToggle={toggle("utxo")}
      >
        <UTxOBuilder />
      </ToolPanel>
      <ToolPanel
        title="Log Viewer"
        subtitle="Debug wallet interactions"
        icon={<TerminalIcon sx={iconSx("logs")} />}
        expanded={expanded === "logs"}
        onToggle={toggle("logs")}
      >
        <LogViewerComponent />
      </ToolPanel>
    </Box>
  );
};

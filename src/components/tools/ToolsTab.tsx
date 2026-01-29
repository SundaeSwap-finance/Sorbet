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

type ToolPanel = "utxo" | "logs" | null;

export const ToolsTab: React.FC = () => {
  const [expanded, setExpanded] = useState<ToolPanel>("utxo");

  const handleChange = (panel: ToolPanel) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : null);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Accordion
        expanded={expanded === "utxo"}
        onChange={handleChange("utxo")}
        sx={{
          borderRadius: "12px !important",
          "&:before": { display: "none" },
          boxShadow: "none",
          border: "1px solid",
          borderColor: expanded === "utxo" ? "primary.200" : "grey.200",
          bgcolor: expanded === "utxo" ? "primary.50" : "white",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ px: 2, py: 0.5 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: expanded === "utxo" ? "primary.100" : "grey.100" }}>
              <BuildIcon sx={{ fontSize: 20, color: expanded === "utxo" ? "primary.main" : "grey.600" }} />
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                UTxO Builder
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Create custom UTxO responses
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
          <UTxOBuilder />
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expanded === "logs"}
        onChange={handleChange("logs")}
        sx={{
          borderRadius: "12px !important",
          "&:before": { display: "none" },
          boxShadow: "none",
          border: "1px solid",
          borderColor: expanded === "logs" ? "primary.200" : "grey.200",
          bgcolor: expanded === "logs" ? "primary.50" : "white",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ px: 2, py: 0.5 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: expanded === "logs" ? "primary.100" : "grey.100" }}>
              <TerminalIcon sx={{ fontSize: 20, color: expanded === "logs" ? "primary.main" : "grey.600" }} />
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Log Viewer
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Debug wallet interactions
              </Typography>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
          <LogViewerComponent />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

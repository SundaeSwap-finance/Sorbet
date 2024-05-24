import { IconButton, IconButtonProps, SvgIconProps, Tooltip } from "@mui/material";
import React from "react";

interface SorbetIconButtonProps extends IconButtonProps {
  tooltipTitle: string,
  children: React.ReactElement<SvgIconProps>,
}
export const SorbetIconButton = ({ tooltipTitle, children, ...rest }: SorbetIconButtonProps) => (
  <IconButton
    sx={{ width: 48, height: 48 }}
    aria-label={tooltipTitle}
    {...rest}
  >
    <Tooltip
      title={tooltipTitle}
      placement='top'
    >
      {children}
    </Tooltip>
  </IconButton>
)
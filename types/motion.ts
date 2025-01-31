import { HTMLMotionProps, motion } from 'framer-motion';

export interface MotionComponentProps {
  className?: string;
}

export type MotionDivProps = HTMLMotionProps<'div'> & MotionComponentProps;
export type MotionButtonProps = HTMLMotionProps<'button'> & MotionComponentProps;

export const MotionDiv = motion.div as React.ForwardRefExoticComponent<MotionDivProps>;
export const MotionButton = motion.button as React.ForwardRefExoticComponent<MotionButtonProps>; 
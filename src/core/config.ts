// "Index units" are independent of shape size (the ring always has the same sample count); pixel values scale with it

export const DEFAULT_CONFIG = {
  clickDepthSpring:            115,
  clickDepthDamping:           18,

  insidePressSpring:           92,
  insidePressDamping:          15,

  insideLocalBulgeImpulse:     390,
  insideLocalHoldBulgeForce:   48,

  pressSpring:                 76,
  pressDamping:                13,
  holdPressAmount:             0,

  heldCurveSpring:             135,
  heldCurveDamping:            22,
  insideHeldBulgeAmount:       10.8,
  insideHeldHaloAmount:        2.65,
  insideHeldDepthAmount:       0,

  insidePointInfluenceWidth:   38,
  insidePointHaloWidth:        70,
  insidePointEdgeBoost:        0.44,

  outsideHeldDentAmount:       7.2,
  outsideHeldSideBulgeAmount:  1.7,
  outsideHeldDepthAmount:      9.4,

  normalBlendPasses:           3,
  curveTension:                0.68,

  axisDepth:                   34,
  axisSpring:                  48,
  axisDamping:                 11,

  depthImpulse:                420,
  depthBulgeImpulse:           130,
  depthSpring:                 76,
  depthDamping:                14,
  depthCoupling:               150,

  maxDepthIn:                  -26,
  maxDepthOut:                 16,

  zRotateSpring:               42,
  zRotateDamping:              12,
  zRotateImpulse:              0.14,

  membraneSpring:              96,
  membraneDamping:             17,
  waveCoupling:                145,
  pressure:                    620,
  volumeCorrection:            0.1,

  outsideDentImpulse:          255,
  outsideSideBulgeImpulse:     54,
  outsideOppositeBulgeImpulse: 74,
  rippleWidth:                 8,

  outsideHoldForce:            20,
  outsideHoldDepthForce:       52,

  maxDent:                     8,
  maxBulge:                    24,

  perspective:                 390,

  samples:                     240,
};

export type DropletConfig = typeof DEFAULT_CONFIG;

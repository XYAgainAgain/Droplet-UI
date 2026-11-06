// Component modules register nothing, so tests import this (warn-and-skip, like the root)
import { defineAll } from '../register.js';

defineAll({ strict: false });

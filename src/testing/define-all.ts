// Importing a component module registers nothing, so component tests import this
// for every element, warn-and-skip like the root entry
import { defineAll } from '../register.js';

defineAll({ strict: false });

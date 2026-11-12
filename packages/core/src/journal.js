import {requireValue} from './errors.js';
/** Restore only our last write; never undo a newer host edit. */
export class StyleJournal {
  #entries = new Map();
  write(element, property, value, priority = '') {
    let map = this.#entries.get(element);
    if (!map) this.#entries.set(element, map = new Map());
    const style=element.style, current=style.getPropertyValue(property), currentPriority=style.getPropertyPriority(property);
    let entry=map.get(property);
    if (!entry) {
      entry={original:current, originalPriority:currentPriority, last:current, priority:currentPriority};
      map.set(property,entry);
    }
    requireValue(current===entry.last && currentPriority===entry.priority,
      'OWNERSHIP_LOST', 'The host changed a director-owned property.');
    style.setProperty(property,value,priority);
    entry.last=style.getPropertyValue(property); entry.priority=style.getPropertyPriority(property);
  }
  restore() {
    for (const [element,entries] of this.#entries) for (const [property,entry] of entries) {
      const style=element.style;
      if (style.getPropertyValue(property)!==entry.last || style.getPropertyPriority(property)!==entry.priority) continue;
      if (entry.original) style.setProperty(property,entry.original,entry.originalPriority);
      else style.removeProperty(property);
    }
    this.#entries.clear();
  }
}

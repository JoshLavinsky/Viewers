import * as ContextMenuItemsBuilder from './ContextMenuItemsBuilder';
import { vec2 } from 'gl-matrix';
import ContextMenu from './ContextMenu';

type Obj = Record<string, unknown>;
export type Point = {
  x: number;
  y: number;
};

/**
 * The context menu controller is a helper class that knows how
 * to manage context menus based on the UI Customization Service.
 * There are a few parts to this:
 *    1. Basic controls to manage displaying and hiding context menus
 *    2. Menu selection services, which use the UI customization service
 *       to choose which menu to display
 *    3. Menu item adapter services to convert menu items into displayable and actionable items.
 */
export default class ContextMenuController {
  commandsManager: Obj;
  services: Obj;
  menuItems: [];

  constructor(servicesManager: Obj, commandsManager: Obj) {
    this.services = servicesManager.services as Obj;
    this.commandsManager = commandsManager;
  }

  public closeViewerContextMenu(): void {
    this.services.uiDialogService.dismiss({ id: 'context-menu' });
  }

  public showContextMenu(
    contextMenuProps: Obj,
    activeViewerElement: Obj,
    defaultPointsPosition?: Point | vec2
  ): void {
    if (!this.services.uiDialogService) {
      console.warn('Unable to show dialog; no UI Dialog Service available.');
      return;
    }

    const {
      event,
      subMenu,
      menuId,
      menus,
      refs,
      checkProps,
    } = contextMenuProps;

    const items = ContextMenuItemsBuilder.getMenuItems(
      checkProps || contextMenuProps,
      event,
      menus,
      refs,
      menuId
    );

    this.services.uiDialogService.dismiss({ id: 'context-menu' });
    this.services.uiDialogService.create({
      id: 'context-menu',
      isDraggable: false,
      preservePosition: false,
      preventCutOf: true,
      defaultPosition: ContextMenuController._getDefaultPosition(
        defaultPointsPosition,
        event?.detail,
        activeViewerElement
      ),
      event,
      content: ContextMenu,

      onClickOutside: () =>
        this.services.UIDialogService.dismiss({ id: 'context-menu' }),

      contentProps: {
        items,
        checkProps,
        menus,
        event,
        subMenu,
        eventData: event?.detail,
        refs,
        onRunCommands: item => {
          const { commands } = item;

          commands.forEach(command =>
            this.commandsManager.runCommand(
              command.commandName,
              {
                ...command.commandOptions,
                refs,
                ...checkProps,
              },
              command.context
            )
          );
        },

        onClose: () => {
          this.services.UIDialogService.dismiss({ id: 'context-menu' });
        },

        /**
         * Displays a sub-menu, removing this menu
         * @param {*} item
         * @param {*} itemRef
         * @param {*} subProps
         */
        onSubMenu: (item, itemRef, subProps) => {
          if (!itemRef.subMenu) {
            console.warn('No submenu defined for', item, itemRef, subProps);
            return;
          }
          this.showContextMenu(
            {
              ...contextMenuProps,
              menuId: itemRef.subMenu,
            },
            activeViewerElement,
            defaultPointsPosition
          );
        },

        onDefault: (item, itemRef, subProps) => {
          const { commandName, commandOptions, context } = itemRef;

          if (!commandName) {
            return;
          }

          this.commandsManager.runCommand(
            commandName,
            {
              ...itemRef,
              ...commandOptions,
              ...checkProps,
              refs,
            },
            context
          );
        },
      },
    });
  }

  static getDefaultPosition = (): Point => ({
    x: 0,
    y: 0,
  });

  static _getEventDefaultPosition = (eventDetail): Point => ({
    x: eventDetail && eventDetail.currentPoints.client[0],
    y: eventDetail && eventDetail.currentPoints.client[1],
  });

  static _getViewerElementDefaultPosition = (viewerElement): Point => {
    if (viewerElement) {
      const boundingClientRect = viewerElement.getBoundingClientRect();
      return {
        x: boundingClientRect.x,
        y: boundingClientRect.y,
      };
    }

    return {
      x: undefined,
      y: undefined,
    };
  };

  static _getCanvasPointsPosition = (
    points: (vec2 | Point)[] = [],
    viewerElementOfReference
  ) => {
    const viewerPos = ContextMenuController._getViewerElementDefaultPosition(
      viewerElementOfReference
    );

    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const point = {
        x: points[pointIndex][0] || points[pointIndex]['x'],
        y: points[pointIndex][1] || points[pointIndex]['y'],
      };
      if (
        ContextMenuController._isValidPosition(point) &&
        ContextMenuController._isValidPosition(viewerPos)
      ) {
        return {
          x: point.x + viewerPos.x,
          y: point.y + viewerPos.y,
        };
      }
    }
  };

  static _isValidPosition = source => {
    return (
      source && typeof source.x === 'number' && typeof source.y === 'number'
    );
  };

  /**
   * Returns the context menu default position. It look for the positions of: canvasPoints (got from selected), event that triggers it, current viewport element
   */
  static _getDefaultPosition = (canvasPoints, eventDetail, viewerElement) => {
    function* getPositionIterator() {
      yield ContextMenuController._getCanvasPointsPosition(
        canvasPoints,
        viewerElement
      );
      yield ContextMenuController._getEventDefaultPosition(eventDetail);
      yield ContextMenuController._getViewerElementDefaultPosition(
        viewerElement
      );
      yield ContextMenuController.getDefaultPosition();
    }

    const positionIterator = getPositionIterator();

    let current = positionIterator.next();
    let position = current.value;

    while (!current.done) {
      position = current.value;

      if (ContextMenuController._isValidPosition(position)) {
        positionIterator.return();
      }
      current = positionIterator.next();
    }

    return position;
  };
}

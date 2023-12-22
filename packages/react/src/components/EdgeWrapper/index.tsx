import { memo, useState, useMemo, useRef, type KeyboardEvent, useCallback } from 'react';
import cc from 'classcat';
import { shallow } from 'zustand/shallow';
import {
  getMarkerId,
  elementSelectionKeys,
  getEdgePosition,
  errorMessages,
  getElevatedEdgeZIndex,
} from '@xyflow/system';

import { useStoreApi, useStore } from '../../hooks/useStore';
import { ARIA_EDGE_DESC_KEY } from '../A11yDescriptions';
import type { EdgeWrapperProps } from '../../types';
import { builtinEdgeTypes, nullPosition } from './utils';
import EdgeUpdateAnchors from './EdgeUpdateAnchors';

function EdgeWrapper({
  id,
  edgesFocusable,
  edgesUpdatable,
  elementsSelectable,
  onClick,
  onDoubleClick,
  sourceHandleId,
  targetHandleId,
  onContextMenu,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  edgeUpdaterRadius,
  onEdgeUpdate,
  onEdgeUpdateStart,
  onEdgeUpdateEnd,
  rfId,
  edgeTypes,
  elevateEdgesOnSelect,
  noPanClassName,
  onError,
}: EdgeWrapperProps): JSX.Element | null {
  const edge = useStore((s) => s.edgeLookup.get(id)!);

  let edgeType = edge.type || 'default';
  let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType];

  if (EdgeComponent === undefined) {
    onError?.('011', errorMessages['error011'](edgeType));
    edgeType = 'default';
    EdgeComponent = builtinEdgeTypes.default;
  }

  const isFocusable = !!(edge.focusable || (edgesFocusable && typeof edge.focusable === 'undefined'));
  const isUpdatable =
    typeof onEdgeUpdate !== 'undefined' &&
    (edge.updatable || (edgesUpdatable && typeof edge.updatable === 'undefined'));
  const isSelectable = !!(edge.selectable || (elementsSelectable && typeof edge.selectable === 'undefined'));

  const edgeRef = useRef<SVGGElement>(null);
  const [updateHover, setUpdateHover] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const store = useStoreApi();

  const { zIndex, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useStore(
    useCallback(
      (store) => {
        const sourceNode = store.nodeLookup.get(edge.source);
        const targetNode = store.nodeLookup.get(edge.target);

        if (!sourceNode || !targetNode) {
          return {
            zIndex: edge.zIndex,
            ...nullPosition,
          };
        }

        const edgePosition = getEdgePosition({
          id,
          sourceNode,
          targetNode,
          sourceHandle: sourceHandleId || null,
          targetHandle: targetHandleId || null,
          connectionMode: store.connectionMode,
          onError,
        });

        const zIndex = getElevatedEdgeZIndex({
          selected: edge.selected,
          zIndex: edge.zIndex,
          sourceNode,
          targetNode,
          elevateOnSelect: elevateEdgesOnSelect,
        });

        return {
          zIndex,
          ...(edgePosition || nullPosition),
        };
      },
      [edge.source, edge.target, edge.selected, edge.zIndex, elevateEdgesOnSelect]
    ),
    shallow
  );

  const markerStartUrl = useMemo(
    () => (edge.markerStart ? `url(#${getMarkerId(edge.markerStart, rfId)})` : undefined),
    [edge.markerStart, rfId]
  );

  const markerEndUrl = useMemo(
    () => (edge.markerEnd ? `url(#${getMarkerId(edge.markerEnd, rfId)})` : undefined),
    [edge.markerEnd, rfId]
  );

  if (edge.hidden || !sourceX || !sourceY || !targetX || !targetY) {
    return null;
  }

  const onEdgeClick = (event: React.MouseEvent<SVGGElement, MouseEvent>): void => {
    const { addSelectedEdges, unselectNodesAndEdges, multiSelectionActive } = store.getState();

    if (isSelectable) {
      store.setState({ nodesSelectionActive: false });

      if (edge.selected && multiSelectionActive) {
        unselectNodesAndEdges({ nodes: [], edges: [edge] });
        edgeRef.current?.blur();
      } else {
        addSelectedEdges([id]);
      }
    }

    if (onClick) {
      onClick(event, edge);
    }
  };

  const onEdgeDoubleClick = onDoubleClick
    ? (event: React.MouseEvent) => {
        onDoubleClick(event, { ...edge });
      }
    : undefined;
  const onEdgeContextMenu = onContextMenu
    ? (event: React.MouseEvent) => {
        onContextMenu(event, { ...edge });
      }
    : undefined;
  const onEdgeMouseEnter = onMouseEnter
    ? (event: React.MouseEvent) => {
        onMouseEnter(event, { ...edge });
      }
    : undefined;
  const onEdgeMouseMove = onMouseMove
    ? (event: React.MouseEvent) => {
        onMouseMove(event, { ...edge });
      }
    : undefined;
  const onEdgeMouseLeave = onMouseLeave
    ? (event: React.MouseEvent) => {
        onMouseLeave(event, { ...edge });
      }
    : undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    if (elementSelectionKeys.includes(event.key) && isSelectable) {
      const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
      const unselect = event.key === 'Escape';

      if (unselect) {
        edgeRef.current?.blur();
        unselectNodesAndEdges({ edges: [edge] });
      } else {
        addSelectedEdges([id]);
      }
    }
  };

  return (
    <svg style={{ zIndex }}>
      <g
        className={cc([
          'react-flow__edge',
          `react-flow__edge-${edgeType}`,
          edge.className,
          noPanClassName,
          {
            selected: edge.selected,
            animated: edge.animated,
            inactive: !isSelectable && !onClick,
            updating: updateHover,
          },
        ])}
        onClick={onEdgeClick}
        onDoubleClick={onEdgeDoubleClick}
        onContextMenu={onEdgeContextMenu}
        onMouseEnter={onEdgeMouseEnter}
        onMouseMove={onEdgeMouseMove}
        onMouseLeave={onEdgeMouseLeave}
        onKeyDown={isFocusable ? onKeyDown : undefined}
        tabIndex={isFocusable ? 0 : undefined}
        role={isFocusable ? 'button' : 'img'}
        data-id={id}
        data-testid={`rf__edge-${id}`}
        aria-label={
          edge.ariaLabel === null ? undefined : edge.ariaLabel || `Edge from ${edge.source} to ${edge.target}`
        }
        aria-describedby={isFocusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : undefined}
        ref={edgeRef}
      >
        {!updating && (
          <EdgeComponent
            id={id}
            source={edge.source}
            target={edge.target}
            selected={edge.selected}
            animated={edge.animated}
            label={edge.label}
            labelStyle={edge.labelStyle}
            labelShowBg={edge.labelShowBg}
            labelBgStyle={edge.labelBgStyle}
            labelBgPadding={edge.labelBgPadding}
            labelBgBorderRadius={edge.labelBgBorderRadius}
            sourceX={sourceX}
            sourceY={sourceY}
            targetX={targetX}
            targetY={targetY}
            sourcePosition={sourcePosition}
            targetPosition={targetPosition}
            data={edge.data}
            style={edge.style}
            sourceHandleId={sourceHandleId}
            targetHandleId={targetHandleId}
            markerStart={markerStartUrl}
            markerEnd={markerEndUrl}
            pathOptions={'pathOptions' in edge ? edge.pathOptions : undefined}
            interactionWidth={edge.interactionWidth}
          />
        )}
        {isUpdatable && (
          <EdgeUpdateAnchors
            edge={edge}
            isUpdatable={isUpdatable}
            edgeUpdaterRadius={edgeUpdaterRadius}
            onEdgeUpdate={onEdgeUpdate}
            onEdgeUpdateStart={onEdgeUpdateStart}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            sourceX={sourceX}
            sourceY={sourceY}
            targetX={targetX}
            targetY={targetY}
            sourcePosition={sourcePosition}
            targetPosition={targetPosition}
            setUpdateHover={setUpdateHover}
            setUpdating={setUpdating}
            sourceHandleId={sourceHandleId}
            targetHandleId={targetHandleId}
          />
        )}
      </g>
    </svg>
  );
}

EdgeWrapper.displayName = 'EdgeWrapper';

export default memo(EdgeWrapper);
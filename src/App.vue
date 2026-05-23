<template>
  <router-view />
</template>

<style lang="less">
html {
  background-color: var(--el-bg-color-overlay);
}

html.dark .el-button {
  --el-button-divide-border-color: rgba(0, 0, 0, 0.5);
}

.lv-tabs {

  .el-tabs__content {
    flex: 1;
    overflow-y: auto;
  }

  &.el-tabs.el-tabs--top.el-tabs--card>.el-tabs__header .el-tabs__nav {
    border: 0 none;
  }
  &.el-tabs.el-tabs--top.el-tabs--card>.el-tabs__header .el-tabs__item {
    font-size: 12px;
    border: 0 none;
    border-radius: 4px;
    margin: 8px 0 0 8px;
    padding: 0px 6px;
    height: 24px;
    transition: all .1s;
    user-select:none;
  }
  &.el-tabs.el-tabs--top.el-tabs--card>.el-tabs__header .el-tabs__item.is-active {
    background-color: #f5f5f5;
    color: #191919;
  }
  .el-tabs__item.is-top {
    border: 0 none;
  }
  .el-tabs__item:hover {
    color: #999;
  }
  .el-tabs__header {
    margin: 0;
    align-items: flex-start;
  }
  .el-tab-pane {
    height: 100%;
  }
  .el-tabs__new-tab {
    margin-right: 10px;
  }
}

.dark {
  .dash-tabs {
    &.el-tabs.el-tabs--top.el-tabs--card>.el-tabs__header .el-tabs__item.is-active {
      background-color: #383838;
      color: #fff;
    }
  }
}

.el-card {
  --el-card-padding: 12px;
}
</style>
<style>
.splitpanes--vertical .splitpanes__pane {
  transition: none;
}
.splitpanes.default-theme .splitpanes__pane {
  background-color: var(--el-bg-color) !important;
}
.dark .default-theme.splitpanes--vertical>.splitpanes__splitter, 
.dark .default-theme .splitpanes--vertical>.splitpanes__splitter {
  width: 4px;
  background-color: #333 !important;
  border-color: #333;
}
</style>

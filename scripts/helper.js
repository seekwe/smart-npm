var fs = require('fs'),
  log = require('lac').logDeep,
  path = require('path');

var isWin = process.platform === 'win32',
  npmBinDir = path.dirname(process.execPath),
  npmPath = path.join(npmBinDir, isWin ? 'npm.cmd' : 'npm'),
  npmTmpPath = path.join(npmBinDir, isWin ? '_npm-original.cmd' : '_npm-original'),
  npmDestPath = path.resolve(path.join(npmBinDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')),
  npmBackupPath = path.join(npmBinDir, isWin ? 'npm-original.cmd' : 'npm-original');

var smartDestPath = path.resolve(path.join(__dirname, '..', 'bin', 'smart-npm.js'));

function renameMsg(type, from, to) {
  console.log('\r\n' + type + ' rename: ' + from + ' => ' + to + '\r\n');
}

/**
 *
 * 判断指定的 文件 是否是默认的 npm
 *
 * TODO window 处理方式不一样，window 的 npm 不是一个 link，它就是一个 .cmd 文件，并且不会被替换掉
 *
 * @param {String} originalNpmFile - 原 npm 文件路径
 */
function isOriginalNpm(originalNpmFile) {
  if (isWin) { return true; }

  try {
    var fullpath = path.resolve(originalNpmFile),
      realpath = fs.realpathSync(originalNpmFile);

    if (fullpath !== realpath && realpath.split('/').indexOf('npm') > 0) {
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * 判断是否是通过在本地用 `npm link` 安装 package 的
 *
 * @return {Boolean}
 */
// function isInstalledByLink() {
//   return false;
// }

/**
 * pre-install hook
 *
 * 1. 先确保 npm 文件存在，并且 npm 是默认的 npm 命令的链接
 * 2. 将原 npm 链接文件备份到一个临时文件
 *
 */
function preInstall() {
  if (fs.existsSync(npmPath) && isOriginalNpm(npmPath)) {
    try {
      fs.renameSync(npmPath, npmTmpPath);
      renameMsg('Success', npmPath, npmTmpPath);
    } catch (e) {
      renameMsg('Error', npmPath, npmTmpPath);
      process.exit(1);
    }
  }
}

/**
 *
 * post-install hook
 *
 * 1. 判断 npm 文件是否存在
 *
 *   - 如果存在，则表示此次安装是全局安装，并将临时文件重命名成 npm-original
 *   - 如果不存在，则表示是本地安装，并将临时文件重命名成之前的 npm
 *
 * 2. 用户可能通过 `npm link` 的形式本地开发
 *
 *   > pre-install
 *   > install package and then link bin
 *   > post-install
 *   >
 *   > 但在使用 `npm link` 命令时，link bin 会放到 post-install 之后，所以蛋疼！
 *
 * TODO 想办法区分 `npm link` 和 `npm install --global smart-npm`
 *
 */
function postInstall() {
  try {
    if (fs.existsSync(npmPath)) fs.unlinkSync(npmPath);
    if (fs.existsSync(npmBackupPath)) fs.unlinkSync(npmBackupPath);

    fs.symlinkSync(smartDestPath, npmPath);
    fs.symlinkSync(npmDestPath, npmBackupPath);
  } catch (e) {
    log('\n!%s!\n', '创建新的 npm 文件失败，原因: ' + e.message);
    log('**如果你想用 smart-npm 替换原生的 npm，有如下方法可以尝试：**\n');
    log('  *1. 如果你是 Unix 系统，你可以创建一个别名* %s *或将它写入你的* %s *文件*', '` alias smart-npm="npm" `', '^.bashrc^');
    log('  *2. 手动将文件* ^%s^* 链接到文件* ^%s^', npmPath, smartDestPath);
    log('  *3. 尝试安装 smart-npm@1 ：* ` npm install --global smart-npm@1 --registry=https://registry.npm.taobao.org/ `');
    log('\n');
  }

  // 判断有没新的 npm 文件，有的话全局安装成功，否则是本地安装，把原 npm 文件恢复
  // if (fs.existsSync(npmPath) || isInstalledByLink() || isWin) {
  //   fs.renameSync(npmTmpPath, npmBackupPath);
  //   renameMsg('Success', npmTmpPath, npmBackupPath);
  // } else {
  //   fs.renameSync(npmTmpPath, npmPath);
  //   renameMsg('Success', npmTmpPath, npmPath);
  // }
}

/**
 * pre-uninstall hook
 *
 * 1. 判断 npm 链接文件是否存在
 *
 *   - 存在就不做任何操作
 *   - 不存在就将备份的 npm 恢复
 */
function uninstall() {
  if (fs.existsSync(npmPath)) fs.unlinkSync(npmPath);
  if (fs.existsSync(npmBackupPath)) fs.unlinkSync(npmBackupPath);

  fs.symlinkSync(npmDestPath, npmPath);
  // if (!fs.existsSync(npmPath) && fs.existsSync(npmBackupPath)) {
  //   try {
  //     fs.renameSync(npmBackupPath, npmPath);
  //     renameMsg('Success', npmBackupPath, npmPath);
  //   } catch (e) {
  //     renameMsg('Error', npmBackupPath, npmPath);
  //     process.exit(1);
  //   }
  // }
}

module.exports = {
  uninstall: uninstall
};

switch (process.argv[2]) {
  case 'preinstall': preInstall(); break;
  case 'postinstall': postInstall(); break;
  // default : console.error('Command no found!'); process.exit(1);
}

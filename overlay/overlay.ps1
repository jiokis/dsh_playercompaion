param(
    [Parameter(Mandatory = $true)][string]$StatePath
)

$ErrorActionPreference = 'SilentlyContinue'
$script:Dir = Split-Path -Parent $StatePath
$script:LogPath = Join-Path $script:Dir 'overlay.log'
$script:LayoutPath = Join-Path $script:Dir 'layout.json'
$script:CommandPath = Join-Path $script:Dir 'command.json'
$script:Window = $null
$script:Dragging = $false
$script:Layout = [ordered]@{ panelX = -1; panelY = -1; ballX = -1; ballY = -1; collapsed = $false }

function Log([string]$m) { try { Add-Content -LiteralPath $script:LogPath -Value ('[' + (Get-Date).ToString('s') + '] ' + $m) -Encoding UTF8 } catch {} }
function Brush([string]$h) { try { return [System.Windows.Media.BrushConverter]::new().ConvertFromString($h) } catch { return $null } }
function Read-State {
    try {
        if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
        $raw = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8
        if ($raw) { return $raw | ConvertFrom-Json }
    } catch {}
    return $null
}
function Read-Layout {
    try {
        if (Test-Path -LiteralPath $script:LayoutPath) {
            $saved = Get-Content -LiteralPath $script:LayoutPath -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($k in @('panelX','panelY','ballX','ballY')) { if ($null -ne $saved.$k) { $script:Layout[$k] = [double]$saved.$k } }
            if ($null -ne $saved.collapsed) { $script:Layout.collapsed = [bool]$saved.collapsed }
        }
    } catch {}
}
function Save-Layout {
    try {
        $tmp = $script:LayoutPath + '.tmp'
        Set-Content -LiteralPath $tmp -Value ($script:Layout | ConvertTo-Json -Compress) -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $script:LayoutPath -Force
    } catch {}
}
function Send-Command([string]$action) {
    try {
        $tmp = $script:CommandPath + '.tmp'
        $cmd = @{ id = [guid]::NewGuid().ToString(); action = $action; ts = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
        # PowerShell 5.1 "-Encoding UTF8" writes a BOM; Node JSON.parse would
        # silently reject every overlay command. Write BOM-less UTF-8.
        [System.IO.File]::WriteAllText($tmp, $cmd, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $script:CommandPath -Force
    } catch {}
}

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Xaml
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class LoreOverlayWin32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
}
"@

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="旅途记录仪" Width="560" Height="300" WindowStyle="None" AllowsTransparency="True"
        Background="Transparent" Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        ResizeMode="NoResize" WindowStartupLocation="Manual" Opacity="0"
        FontFamily="Microsoft YaHei UI" UseLayoutRounding="True" SnapsToDevicePixels="True">
  <Grid>
    <Border x:Name="Panel" CornerRadius="16" BorderBrush="#4A334A6A" BorderThickness="1">
      <Border.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
          <GradientStop Color="#F2171D2A" Offset="0"/>
          <GradientStop Color="#F20D1017" Offset="1"/>
        </LinearGradientBrush>
      </Border.Background>
      <Border.Effect><DropShadowEffect BlurRadius="30" ShadowDepth="0" Opacity="0.55" Color="#000000"/></Border.Effect>
      <Grid Margin="18,14,18,12">
        <Grid.RowDefinitions>
          <RowDefinition Height="34"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid x:Name="DragHandle" Grid.Row="0" Background="Transparent" Cursor="SizeAll">
          <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
          <Border Width="28" Height="28" CornerRadius="9" Background="#1C2A4A" BorderBrush="#2A3C5E" BorderThickness="1">
            <Path Data="M4,3 L12,3 L12,15 L8,12 L4,15 Z" Fill="#FFFFFF" Stretch="Uniform" Width="11" Height="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
          </Border>
          <StackPanel Grid.Column="1" Margin="10,0,0,0" VerticalAlignment="Center">
            <TextBlock Text="旅途记录仪" Foreground="#F2F5FA" FontSize="13.5" FontWeight="SemiBold"/>
            <TextBlock Text="LORE COMPANION" Foreground="#586274" FontSize="8" FontWeight="SemiBold" Margin="0,1,0,0"/>
          </StackPanel>
          <Border x:Name="StatusPill" Grid.Column="2" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="10" Padding="7,3" VerticalAlignment="Center" Margin="0,0,8,0">
            <StackPanel Orientation="Horizontal">
              <Ellipse x:Name="Dot" Width="6" Height="6" Fill="#7EA2FF" VerticalAlignment="Center" Margin="0,0,5,0"><Ellipse.Effect><DropShadowEffect BlurRadius="8" ShadowDepth="0" Opacity="0.9" Color="#7EA2FF"/></Ellipse.Effect></Ellipse>
              <TextBlock x:Name="Status" Foreground="#9DB7FF" FontSize="10" MaxWidth="130" TextTrimming="CharacterEllipsis"/>
            </StackPanel>
          </Border>
          <Border x:Name="BtnCollapse" Grid.Column="3" Width="26" Height="26" CornerRadius="8" Background="#161B24" BorderBrush="#2A3140" BorderThickness="1" Cursor="Hand">
            <TextBlock Text="—" Foreground="#9AA6B8" FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
          </Border>
        </Grid>
        <StackPanel Grid.Row="1" Orientation="Horizontal" Margin="0,10,0,0">
          <Border x:Name="SpeakerBadge" Background="#221B10" BorderBrush="#3A2E16" BorderThickness="1" CornerRadius="6" Padding="7,2" Margin="0,0,8,0" Visibility="Collapsed">
            <TextBlock x:Name="Speaker" Foreground="#E8C47A" FontSize="12" FontWeight="SemiBold"/>
          </Border>
          <TextBlock x:Name="SpeakerTitle" Foreground="#8A94A6" FontSize="10.5" VerticalAlignment="Center" TextTrimming="CharacterEllipsis" Visibility="Collapsed"/>
        </StackPanel>
        <TextBlock x:Name="Body" Grid.Row="2" Foreground="#F2F5FA" FontSize="15.5" LineHeight="24" TextWrapping="Wrap" Margin="0,10,0,0" MaxHeight="104"/>
        <StackPanel Grid.Row="3" Orientation="Horizontal" Margin="0,9,0,0">
          <Border x:Name="BtnShot" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="8" Padding="11,5" Margin="0,0,7,0" Cursor="Hand"><TextBlock Text="截图" Foreground="#A9C1FF" FontSize="11.5"/></Border>
          <Border x:Name="BtnAnalyze" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="8" Padding="11,5" Margin="0,0,7,0" Cursor="Hand"><TextBlock Text="分析" Foreground="#A9C1FF" FontSize="11.5"/></Border>
          <Border x:Name="BtnForce" Background="#2A2117" BorderBrush="#5A4522" BorderThickness="1" CornerRadius="8" Padding="11,5" Margin="0,0,7,0" Cursor="Hand" ToolTip="忽略对话判定，强制把当前画面记成对话"><TextBlock Text="强制" Foreground="#E8C47A" FontSize="11.5"/></Border>
          <Border x:Name="BtnRead" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="8" Padding="11,5" Margin="0,0,7,0" Cursor="Hand"><TextBlock Text="阅读" Foreground="#A9C1FF" FontSize="11.5"/></Border>
          <Border x:Name="BtnFind" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="8" Padding="11,5" Margin="0,0,7,0" Cursor="Hand"><TextBlock Text="查找" Foreground="#A9C1FF" FontSize="11.5"/></Border>
          <TextBlock Text="拖动标题栏移动 · — 收起" Foreground="#596578" FontSize="9.5" VerticalAlignment="Center" Margin="5,0,0,0"/>
        </StackPanel>
        <Border Grid.Row="4" BorderBrush="#242B36" BorderThickness="0,1,0,0" Margin="0,8,0,0" Padding="0,6,0,0">
          <Grid><TextBlock x:Name="Meta" Foreground="#6F7A8A" FontSize="9.5"/><TextBlock Text="LOCAL OCR" Foreground="#586274" FontSize="9" HorizontalAlignment="Right"/></Grid>
        </Border>
      </Grid>
    </Border>
    <Border x:Name="Ball" Width="52" Height="52" CornerRadius="26" Background="#F2141720" BorderBrush="#4B6CFF" BorderThickness="1" Visibility="Collapsed" Cursor="Hand">
      <Border.Effect><DropShadowEffect BlurRadius="16" ShadowDepth="0" Opacity="0.55" Color="#000000"/></Border.Effect>
      <Grid>
        <Path Data="M4,3 L12,3 L12,15 L8,12 L4,15 Z" Fill="#FFFFFF" Stretch="Uniform" Width="16" Height="19" HorizontalAlignment="Center" VerticalAlignment="Center"/>
        <Ellipse x:Name="BallDot" Width="7" Height="7" Fill="#7EA2FF" HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,7,7,0"/>
      </Grid>
    </Border>
  </Grid>
</Window>
"@

try {
    $script:Window = [System.Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader ([xml]$xaml)))
    $script:Window.Opacity = 0
    Log 'window loaded'
    $script:Window.Add_SourceInitialized({
        try {
            $helper = New-Object System.Windows.Interop.WindowInteropHelper($script:Window)
            $hwnd = $helper.Handle
            $style = [LoreOverlayWin32]::GetWindowLong($hwnd, -20)
            # Keep no-activate/toolwindow/layered, remove WS_EX_TRANSPARENT so the panel is interactive.
            $newStyle = ($style -band (-bnot 0x20)) -bor 0x80000 -bor 0x80 -bor 0x08000000
            [void][LoreOverlayWin32]::SetWindowLong($hwnd, -20, $newStyle)
            Log 'interactive overlay initialized'
        } catch { Log ('style failed: ' + $_.Exception.Message) }
    })
    $script:Window.Add_Closed({ if ($script:Timer) { $script:Timer.Stop() } })
} catch {
    Log ('window creation failed: ' + $_.Exception.Message)
    exit 1
}

function Test-Game {
    try {
        $hwnd = [LoreOverlayWin32]::GetForegroundWindow()
        if ($hwnd -eq [IntPtr]::Zero) { return $false }
        $pidValue = 0
        [void][LoreOverlayWin32]::GetWindowThreadProcessId($hwnd, [ref]$pidValue)
        if (-not $pidValue) { return $false }
        $p = Get-Process -Id $pidValue -ErrorAction Stop
        return @('YuanShen','GenshinImpact','StarRail') -contains $p.ProcessName
    } catch { return $false }
}

function Set-Status([string]$status) {
    $pill = $script:Window.FindName('StatusPill'); $dot = $script:Window.FindName('Dot'); $label = $script:Window.FindName('Status'); $ballDot = $script:Window.FindName('BallDot')
    if (-not $pill) { return }
    $bg = '#182235'; $br = '#2A3C5E'; $fg = '#9DB7FF'; $dc = '#7EA2FF'
    if ($status -match '已记录|完成|成功') { $bg = '#16261F'; $br = '#2B4A3A'; $fg = '#8FE3B0'; $dc = '#4ED89A' }
    elseif ($status -match '重复|查找|分析|截图|处理|等待') { $bg = '#282218'; $br = '#4A3A22'; $fg = '#E8C47A'; $dc = '#E8C47A' }
    elseif ($status -match '空|失败|错误|没有') { $bg = '#2A1A1D'; $br = '#4A2A30'; $fg = '#F09AA6'; $dc = '#F05B6A' }
    $pill.Background = Brush $bg; $pill.BorderBrush = Brush $br; $label.Foreground = Brush $fg; $dot.Fill = Brush $dc
    if ($ballDot) { $ballDot.Fill = Brush $dc }
}

function Set-Mode([bool]$collapsed, $state) {
    $area = [System.Windows.SystemParameters]::WorkArea
    if ($collapsed) {
        $script:Window.FindName('Panel').Visibility = 'Collapsed'
        $script:Window.FindName('Ball').Visibility = 'Visible'
        $script:Window.Width = 52; $script:Window.Height = 52
        $x = if ($script:Layout.ballX -ge 0) { $script:Layout.ballX } else { $script:Layout.panelX }
        $y = if ($script:Layout.ballY -ge 0) { $script:Layout.ballY } else { $script:Layout.panelY }
        if ($x -lt 0) { $x = $area.Left + $area.Width - 52 - 28 }
        if ($y -lt 0) { $y = $area.Top + 28 }
        $script:Window.Left = [Math]::Max($area.Left, $x); $script:Window.Top = [Math]::Max($area.Top, $y)
    } else {
        $script:Window.FindName('Panel').Visibility = 'Visible'
        $script:Window.FindName('Ball').Visibility = 'Collapsed'
        $script:Window.Width = 560; $script:Window.Height = 300
        $x = if ($script:Layout.panelX -ge 0) { $script:Layout.panelX } else { $area.Left + $area.Width - 560 - 28 }
        $y = if ($script:Layout.panelY -ge 0) { $script:Layout.panelY } else { $area.Top + 28 }
        $script:Window.Left = [Math]::Max($area.Left, $x); $script:Window.Top = [Math]::Max($area.Top, $y)
    }
}

function Update-Overlay {
    Read-Layout
    $state = Read-State
    if ($null -eq $state) { $script:Window.Visibility = 'Hidden'; $script:Window.Opacity = 0; return }
    $visible = $state.visible -eq $true
    $preview = $state.preview -eq $true
    $shouldShow = $visible -and ($preview -or -not ($state.autoHideOnGameLost -eq $true) -or (Test-Game))
    if (-not $shouldShow) { $script:Window.Visibility = 'Hidden'; $script:Window.Opacity = 0; return }
    if (-not $script:Dragging) { Set-Mode ($script:Layout.collapsed -eq $true) $state }
    $script:Window.Opacity = [Math]::Min(1, [Math]::Max(0.4, [double]$state.opacity))
    $speakerName = [string]$state.speaker
    $speakerTitle = [string]$state.speakerTitle
    $badge = $script:Window.FindName('SpeakerBadge'); $speaker = $script:Window.FindName('Speaker'); $title = $script:Window.FindName('SpeakerTitle')
    if ($speakerName) {
        $badge.Visibility = 'Visible'; $speaker.Text = $speakerName
        if ($speakerTitle) { $title.Text = $speakerTitle; $title.Visibility = 'Visible' } else { $title.Text = ''; $title.Visibility = 'Collapsed' }
    } else { $badge.Visibility = 'Collapsed'; $title.Text = ''; $title.Visibility = 'Collapsed' }
    $body = [string]$state.text
    if (-not $body) { $body = '等待对话……' }
    $script:Window.FindName('Body').Text = $body
    $status = [string]$state.status
    if (-not $status) { $status = 'OCR 已连接' }
    $script:Window.FindName('Status').Text = $status
    Set-Status $status
    $stamp = ''
    if ($state.ts) { try { $stamp = ([datetime]$state.ts).ToLocalTime().ToString('HH:mm:ss') } catch {} }
    $meta = ''
    if ($state.session) { $meta = [string]$state.session }
    if ($stamp) { if ($meta) { $meta = $meta + ' · ' + $stamp } else { $meta = $stamp } }
    $script:Window.FindName('Meta').Text = $meta
    $script:Window.Visibility = 'Visible'
}

try {
    $script:Window.FindName('DragHandle').Add_MouseLeftButtonDown({
        param($sender, $eventArgs)
        # The collapse button lives inside the drag surface; do not start a drag from it.
        $source = $eventArgs.OriginalSource
        while ($null -ne $source) {
            if ($source -is [System.Windows.FrameworkElement] -and $source.Name -eq 'BtnCollapse') { return }
            try { $source = [System.Windows.Media.VisualTreeHelper]::GetParent($source) } catch { break }
        }
        if ($script:Layout.collapsed -eq $true) { return }
        $script:Dragging = $true
        try {
            $script:Window.DragMove()
            $script:Layout.panelX = [double]$script:Window.Left
            $script:Layout.panelY = [double]$script:Window.Top
            Save-Layout
        } catch { } finally { $script:Dragging = $false }
    })
} catch {}
try { $script:Window.FindName('BtnCollapse').Add_MouseLeftButtonUp({ if ($script:Layout.panelX -ge 0) { $script:Layout.ballX = $script:Layout.panelX; $script:Layout.ballY = $script:Layout.panelY }; $script:Layout.collapsed = $true; Save-Layout; Set-Mode $true $null }) } catch {}
try {
    $script:Window.FindName('Ball').Add_MouseLeftButtonDown({
        # Same drag primitive as the panel: a press+drag moves the ball,
        # a press without movement expands it. Compare window coordinates
        # instead of relying on a second click event (DragMove consumes it).
        $startLeft = [double]$script:Window.Left
        $startTop = [double]$script:Window.Top
        $script:Dragging = $true
        try { $script:Window.DragMove() } catch { } finally { $script:Dragging = $false }
        $moved = ([Math]::Abs([double]$script:Window.Left - $startLeft) -gt 2) -or ([Math]::Abs([double]$script:Window.Top - $startTop) -gt 2)
        if ($moved) {
            $script:Layout.ballX = [double]$script:Window.Left
            $script:Layout.ballY = [double]$script:Window.Top
            Save-Layout
        } else {
            if ($script:Layout.ballX -ge 0) { $script:Layout.panelX = $script:Layout.ballX; $script:Layout.panelY = $script:Layout.ballY }
            $script:Layout.collapsed = $false
            Save-Layout
            Set-Mode $false $null
        }
    })
} catch {}
try { $script:Window.FindName('BtnShot').Add_MouseLeftButtonUp({ Send-Command 'screenshot' }) } catch {}
try { $script:Window.FindName('BtnAnalyze').Add_MouseLeftButtonUp({ Send-Command 'vision' }) } catch {}
try { $script:Window.FindName('BtnForce').Add_MouseLeftButtonUp({ Send-Command 'force' }) } catch {}
try { $script:Window.FindName('BtnRead').Add_MouseLeftButtonUp({ Send-Command 'read' }) } catch {}
try { $script:Window.FindName('BtnFind').Add_MouseLeftButtonUp({ Send-Command 'query' }) } catch {}

$script:Timer = New-Object System.Windows.Threading.DispatcherTimer
$script:Timer.Interval = [TimeSpan]::FromMilliseconds(300)
$script:Timer.Add_Tick({ Update-Overlay })
$script:Timer.Start()
try {
    Update-Overlay
    Log 'entering ShowDialog'
    [void]$script:Window.ShowDialog()
    Log 'ShowDialog returned'
} catch {
    Log ('overlay crashed: ' + $_.Exception.Message)
    exit 1
}

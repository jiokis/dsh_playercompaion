param(
    [Parameter(Mandatory = $true)][string]$StatePath
)

$ErrorActionPreference = 'SilentlyContinue'
$script:LogPath = Join-Path (Split-Path -Parent $StatePath) 'overlay.log'
$script:Window = $null
$script:Timer = $null

function Write-OverlayLog([string]$message) {
    try {
        Add-Content -LiteralPath $script:LogPath -Value ('[' + (Get-Date).ToString('s') + '] ' + $message) -Encoding UTF8
    } catch {
    }
}

function Read-OverlayState {
    try {
        if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
        $raw = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8
        if (-not $raw) { return $null }
        return $raw | ConvertFrom-Json
    } catch {
        Write-OverlayLog ('state read failed: ' + $_.Exception.Message)
        return $null
    }
}

function Brush([string]$hex) {
    try { return [System.Windows.Media.BrushConverter]::new().ConvertFromString($hex) } catch { return $null }
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
        Title="旅途记录仪" Width="480" Height="220"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        ResizeMode="NoResize" WindowStartupLocation="Manual" Opacity="0"
        FontFamily="Microsoft YaHei UI" UseLayoutRounding="True" SnapsToDevicePixels="True"
        TextOptions.TextFormattingMode="Display">
  <Border x:Name="Panel" CornerRadius="16" Background="#F2141720" BorderBrush="#3A2A3140" BorderThickness="1">
    <Border.Effect>
      <DropShadowEffect BlurRadius="28" ShadowDepth="0" Opacity="0.5" Color="#000000"/>
    </Border.Effect>
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="4"/>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>
      <Border Grid.Column="0" Background="#4B6CFF" CornerRadius="2" Margin="0,18,0,18"/>
      <Grid Grid.Column="1" Margin="16,14,16,12">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid Grid.Row="0">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <Border Width="26" Height="26" CornerRadius="9" Background="#1C2A4A" BorderBrush="#2A3C5E" BorderThickness="1" Margin="0,0,10,0">
            <Path Data="M4,3 L12,3 L12,15 L8,12 L4,15 Z" Fill="#FFFFFF" Stretch="Uniform" Width="10" Height="12" HorizontalAlignment="Center" VerticalAlignment="Center"/>
          </Border>
          <StackPanel Grid.Column="1" VerticalAlignment="Center">
            <TextBlock Text="旅途记录仪" Foreground="#F2F5FA" FontSize="13" FontWeight="SemiBold"/>
            <TextBlock Text="LORE COMPANION" Foreground="#586274" FontSize="8.5" FontWeight="SemiBold" Margin="0,1,0,0"/>
          </StackPanel>
          <Border x:Name="StatusPill" Grid.Column="2" Background="#182235" BorderBrush="#2A3C5E" BorderThickness="1" CornerRadius="10" Padding="8,3" VerticalAlignment="Top">
            <StackPanel Orientation="Horizontal">
              <Ellipse x:Name="Dot" Width="6" Height="6" Fill="#7EA2FF" VerticalAlignment="Center" Margin="0,0,5,0"/>
              <TextBlock x:Name="Status" Foreground="#9DB7FF" FontSize="10.5" TextTrimming="CharacterEllipsis" MaxWidth="160"/>
            </StackPanel>
          </Border>
        </Grid>
        <StackPanel Grid.Row="1" Orientation="Horizontal" Margin="0,12,0,0">
          <Border x:Name="SpeakerBadge" Background="#221B10" BorderBrush="#3A2E16" BorderThickness="1" CornerRadius="6" Padding="7,2" Margin="0,0,8,0">
            <TextBlock x:Name="Speaker" Foreground="#E8C47A" FontSize="12" FontWeight="SemiBold"/>
          </Border>
          <TextBlock x:Name="SpeakerTitle" Foreground="#8A94A6" FontSize="11" VerticalAlignment="Center" TextTrimming="CharacterEllipsis"/>
        </StackPanel>
        <TextBlock x:Name="Body" Grid.Row="2" Foreground="#F2F5FA" FontSize="15" LineHeight="23" TextWrapping="Wrap" Margin="0,8,0,0" MaxHeight="76"/>
        <StackPanel x:Name="ChoicesPanel" Grid.Row="3" Orientation="Horizontal" Margin="0,6,0,0"/>
        <Border Grid.Row="4" BorderBrush="#242B36" BorderThickness="0,1,0,0" Margin="0,8,0,0" Padding="0,7,0,0">
          <Grid>
            <TextBlock x:Name="Meta" Foreground="#6F7A8A" FontSize="10"/>
            <TextBlock x:Name="EngineLabel" Foreground="#586274" FontSize="9" HorizontalAlignment="Right"/>
          </Grid>
        </Border>
      </Grid>
    </Grid>
  </Border>
</Window>
"@

try {
    $reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $script:Window = [System.Windows.Markup.XamlReader]::Load($reader)
    $script:Window.Opacity = 0
    Write-OverlayLog 'window loaded'
    $script:Window.Add_SourceInitialized({
        try {
            $helper = New-Object System.Windows.Interop.WindowInteropHelper($script:Window)
            $hwnd = $helper.Handle
            $style = [LoreOverlayWin32]::GetWindowLong($hwnd, -20)
            $newStyle = $style -bor 0x80000 -bor 0x20 -bor 0x80 -bor 0x08000000
            [void][LoreOverlayWin32]::SetWindowLong($hwnd, -20, $newStyle)
            Write-OverlayLog 'source initialized'
        } catch {
            Write-OverlayLog ('click-through failed: ' + $_.Exception.Message)
        }
    })
    $script:Window.Add_Closed({
        if ($script:Timer) { $script:Timer.Stop() }
    })
} catch {
    Write-OverlayLog ('window creation failed: ' + $_.Exception.Message)
    exit 1
}

function Test-GameForeground {
    try {
        $hwnd = [LoreOverlayWin32]::GetForegroundWindow()
        if ($hwnd -eq [IntPtr]::Zero) { return $false }
        $processId = 0
        [void][LoreOverlayWin32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        if (-not $processId) { return $false }
        $process = Get-Process -Id $processId -ErrorAction Stop
        return @('YuanShen', 'GenshinImpact', 'StarRail') -contains $process.ProcessName
    } catch {
        return $false
    }
}

function Set-StatusStyle([string]$status) {
    $pill = $script:Window.FindName('StatusPill')
    $dot = $script:Window.FindName('Dot')
    $label = $script:Window.FindName('Status')
    if (-not $pill -or -not $dot -or -not $label) { return }
    $label.Text = $status
    $background = '#182235'
    $border = '#2A3C5E'
    $foreground = '#9DB7FF'
    $dotColor = '#7EA2FF'
    if ($status -match '已记录|完成|成功') {
        $background = '#16261F'
        $border = '#2B4A3A'
        $foreground = '#8FE3B0'
        $dotColor = '#4ED89A'
    } elseif ($status -match '重复|试运行|预览|待命') {
        $background = '#282218'
        $border = '#4A3A22'
        $foreground = '#E8C47A'
        $dotColor = '#E8C47A'
    } elseif ($status -match '空|未识别|失败|错误') {
        $background = '#2A1A1D'
        $border = '#4A2A30'
        $foreground = '#F09AA6'
        $dotColor = '#F05B6A'
    }
    $pill.Background = Brush $background
    $pill.BorderBrush = Brush $border
    $label.Foreground = Brush $foreground
    $dot.Fill = Brush $dotColor
}

function Update-Overlay {
    $state = Read-OverlayState
    if ($null -eq $state) {
        $script:Window.Visibility = 'Hidden'
        $script:Window.Opacity = 0
        return
    }
    $visible = $state.visible -eq $true
    $preview = $state.preview -eq $true
    $game = Test-GameForeground
    $shouldShow = $visible -and ($preview -or -not ($state.autoHideOnGameLost -eq $true) -or $game)
    if (-not $shouldShow) {
        $script:Window.Visibility = 'Hidden'
        $script:Window.Opacity = 0
        return
    }

    $width = [double]$state.width
    $height = [double]$state.height
    $margin = [double]$state.margin
    if ($width -lt 320) { $width = 480 }
    if ($height -lt 140) { $height = 220 }
    if ($margin -lt 8) { $margin = 28 }
    $screenWidth = [System.Windows.SystemParameters]::PrimaryScreenWidth
    $screenHeight = [System.Windows.SystemParameters]::PrimaryScreenHeight
    $left = $screenWidth - $width - $margin
    $top = $margin
    switch ([string]$state.position) {
        'top-left' { $left = $margin; $top = $margin }
        'bottom-center' { $left = ($screenWidth - $width) / 2; $top = $screenHeight - $height - $margin }
        default { $left = $screenWidth - $width - $margin; $top = $margin }
    }
    $script:Window.Left = [math]::Max(0, $left)
    $script:Window.Top = [math]::Max(0, $top)
    $script:Window.Width = $width
    $script:Window.Height = $height
    $script:Window.Opacity = [math]::Min(1, [math]::Max(0.4, [double]$state.opacity))

    $speakerName = [string]$state.speaker
    $speakerTitle = [string]$state.speakerTitle
    if (-not $speakerName -and $speakerTitle) {
        $speakerName = $speakerTitle
        $speakerTitle = ''
    }
    $badge = $script:Window.FindName('SpeakerBadge')
    $speakerLabel = $script:Window.FindName('Speaker')
    $titleLabel = $script:Window.FindName('SpeakerTitle')
    if ($speakerName) {
        $badge.Visibility = 'Visible'
        $speakerLabel.Text = $speakerName
        if ($speakerTitle) {
            $titleLabel.Text = $speakerTitle
            $titleLabel.Visibility = 'Visible'
        } else {
            $titleLabel.Text = ''
            $titleLabel.Visibility = 'Collapsed'
        }
    } else {
        $badge.Visibility = 'Collapsed'
        $titleLabel.Text = ''
        $titleLabel.Visibility = 'Collapsed'
    }

    $bodyText = [string]$state.text
    if (-not $bodyText) { $bodyText = '等待对话……' }
    $script:Window.FindName('Body').Text = $bodyText

    $panel = $script:Window.FindName('ChoicesPanel')
    $panel.Children.Clear()
    $choices = @($state.choices | Where-Object { $_ })
    if ($choices.Count -gt 0) {
        $panel.Visibility = 'Visible'
        foreach ($choice in ($choices | Select-Object -First 3)) {
            $chip = New-Object System.Windows.Controls.Border
            $chip.CornerRadius = [System.Windows.CornerRadius]::new(7)
            $chip.Background = Brush '#181F2C'
            $chip.BorderBrush = Brush '#2A3448'
            $chip.BorderThickness = [System.Windows.Thickness]::new(1)
            $chip.Padding = [System.Windows.Thickness]::new(8, 2, 8, 2)
            $chip.Margin = [System.Windows.Thickness]::new(0, 0, 6, 0)
            $text = New-Object System.Windows.Controls.TextBlock
            $text.Text = [string]$choice
            $text.Foreground = Brush '#A9C1FF'
            $text.FontSize = 10.5
            $text.FontFamily = 'Microsoft YaHei UI'
            $text.MaxWidth = 190
            $text.TextTrimming = 'CharacterEllipsis'
            $chip.Child = $text
            [void]$panel.Children.Add($chip)
        }
    } else {
        $panel.Visibility = 'Collapsed'
    }

    $status = [string]$state.status
    if (-not $status) { $status = 'OCR 已连接' }
    Set-StatusStyle $status

    $stamp = ''
    if ($state.ts) {
        try { $stamp = ([datetime]$state.ts).ToLocalTime().ToString('HH:mm:ss') } catch { }
    }
    $meta = ''
    if ($state.session) { $meta = [string]$state.session }
    if ($stamp) { if ($meta) { $meta = $meta + ' · ' + $stamp } else { $meta = $stamp } }
    $script:Window.FindName('Meta').Text = $meta
    $engineLabel = 'LOCAL OCR'
    if ($state.backend) { $engineLabel = 'OCR · ' + ([string]$state.backend).ToUpperInvariant() }
    $script:Window.FindName('EngineLabel').Text = $engineLabel

    if (-not $script:ShownLogged) {
        $script:ShownLogged = $true
        Write-OverlayLog ('showing at ' + [int]$script:Window.Left + ',' + [int]$script:Window.Top + ' size ' + [int]$script:Window.Width + 'x' + [int]$script:Window.Height)
    }
    $script:Window.Visibility = 'Visible'
}

$script:Timer = New-Object System.Windows.Threading.DispatcherTimer
$script:Timer.Interval = [TimeSpan]::FromMilliseconds(300)
$script:Timer.Add_Tick({ Update-Overlay })
$script:Timer.Start()

try {
    Update-Overlay
    Write-OverlayLog 'entering ShowDialog'
    [void]$script:Window.ShowDialog()
    Write-OverlayLog 'ShowDialog returned'
} catch {
    Write-OverlayLog ('overlay crashed: ' + $_.Exception.Message)
    exit 1
}

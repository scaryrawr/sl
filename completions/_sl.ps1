
using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName 'sl' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $command = @(
        'sl'
        for ($i = 1; $i -lt $commandElements.Count; $i++) {
            $element = $commandElements[$i]
            if ($element -isnot [StringConstantExpressionAst] -or
                $element.StringConstantType -ne [StringConstantType]::BareWord -or
                $element.Value.StartsWith('-') -or
                $element.Value -eq $wordToComplete) {
                break
        }
        $element.Value
    }) -join ';'

    $completions = @(switch ($command) {
        'sl' {
            [CompletionResult]::new('-a', '-a', [CompletionResultType]::ParameterName, 'An accident is occurring. People cry for help. Lists all files')
            [CompletionResult]::new('--accident', '--accident', [CompletionResultType]::ParameterName, 'An accident is occurring. People cry for help. Lists all files')
            [CompletionResult]::new('-l', '-l', [CompletionResultType]::ParameterName, 'Little version')
            [CompletionResult]::new('--logo', '--logo', [CompletionResultType]::ParameterName, 'Little version')
            [CompletionResult]::new('-F', '-F ', [CompletionResultType]::ParameterName, 'It flies like the galaxy express 999')
            [CompletionResult]::new('--fly', '--fly', [CompletionResultType]::ParameterName, 'It flies like the galaxy express 999')
            [CompletionResult]::new('-c', '-c', [CompletionResultType]::ParameterName, 'C51 appears instead of D51')
            [CompletionResult]::new('--c51', '--c51', [CompletionResultType]::ParameterName, 'C51 appears instead of D51')
            [CompletionResult]::new('-f', '-f', [CompletionResultType]::ParameterName, 'Disables listing files and directories')
            [CompletionResult]::new('--files', '--files', [CompletionResultType]::ParameterName, 'Disables listing files and directories')
            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
            break
        }
    })

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}

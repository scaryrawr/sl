
use builtin;
use str;

set edit:completion:arg-completer[sl] = {|@words|
    fn spaces {|n|
        builtin:repeat $n ' ' | str:join ''
    }
    fn cand {|text desc|
        edit:complex-candidate $text &display=$text' '(spaces (- 14 (wcswidth $text)))$desc
    }
    var command = 'sl'
    for word $words[1..-1] {
        if (str:has-prefix $word '-') {
            break
        }
        set command = $command';'$word
    }
    var completions = [
        &'sl'= {
            cand -a 'An accident is occurring. People cry for help. Lists all files'
            cand --accident 'An accident is occurring. People cry for help. Lists all files'
            cand -l 'Little version'
            cand --logo 'Little version'
            cand -F 'It flies like the galaxy express 999'
            cand --fly 'It flies like the galaxy express 999'
            cand -c 'C51 appears instead of D51'
            cand --c51 'C51 appears instead of D51'
            cand -f 'Disables listing files and directories'
            cand --files 'Disables listing files and directories'
            cand -h 'Print help'
            cand --help 'Print help'
            cand -V 'Print version'
            cand --version 'Print version'
        }
    ]
    $completions[$command]
}
